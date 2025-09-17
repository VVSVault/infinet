import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getUserSubscription, hasExceededTokenLimit, checkRateLimit, logRequest } from '@/lib/database/db'

// Developer emails that bypass all subscription checks
const DEVELOPER_EMAILS = [
  'tannercarlson@vvsvault.com',
  // Add more developer emails here as needed
]

export async function checkSubscription(request: NextRequest) {
  try {
    // Get user ID from Clerk
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'NO_AUTH' },
        { status: 401 }
      )
    }

    // Check if user is a developer (bypass all checks)
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    if (userEmail && DEVELOPER_EMAILS.includes(userEmail.toLowerCase())) {
      console.log(`Developer bypass activated for: ${userEmail}`)
      // Return unlimited access for developers
      return {
        success: true,
        subscription: {
          userId,
          tier: 'developer',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          isTrialing: false,
          trialEndsAt: null,
          isDeveloper: true,
        },
      }
    }

    // Check for active subscription
    const subscription = await getUserSubscription(userId)

    // If no subscription, provide free tier access (500 tokens)
    if (!subscription) {
      // Return free tier access for new users
      return {
        success: true,
        subscription: {
          userId,
          tier: 'free',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          isTrialing: false,
          trialEndsAt: null,
          isFree: true,
          tokenLimit: 500,
        },
      }
    }

    // Check subscription status
    if (subscription.status === 'canceled' || subscription.status === 'suspended') {
      return NextResponse.json(
        {
          error: 'Subscription Inactive',
          code: 'SUBSCRIPTION_INACTIVE',
          message: 'Your subscription is no longer active. Please reactivate to continue.',
          redirect: '/pricing',
        },
        { status: 402 }
      )
    }

    // Check if in trial and trial has expired
    if (subscription.status === 'trial' && subscription.trial_ends_at) {
      if (new Date() > new Date(subscription.trial_ends_at)) {
        return NextResponse.json(
          {
            error: 'Trial Expired',
            code: 'TRIAL_EXPIRED',
            message: 'Your trial has expired. Please subscribe to continue.',
            redirect: '/pricing',
          },
          { status: 402 }
        )
      }
    }

    // Check if past due
    if (subscription.status === 'past_due') {
      return NextResponse.json(
        {
          error: 'Payment Past Due',
          code: 'PAYMENT_PAST_DUE',
          message: 'Your payment is past due. Please update your payment method.',
          redirect: '/billing',
        },
        { status: 402 }
      )
    }

    // Check if billing period has ended
    if (new Date() > new Date(subscription.current_period_end)) {
      return NextResponse.json(
        {
          error: 'Billing Period Ended',
          code: 'BILLING_PERIOD_ENDED',
          message: 'Your billing period has ended. Awaiting renewal.',
          redirect: '/billing',
        },
        { status: 402 }
      )
    }

    // Check token limit
    const exceededLimit = await hasExceededTokenLimit(userId)

    // Log token limit check for debugging
    console.log('Token limit check:', {
      userId,
      tier: subscription.tier,
      exceededLimit,
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
      }
    })

    if (exceededLimit) {
      return NextResponse.json(
        {
          error: 'Token Limit Exceeded',
          code: 'TOKEN_LIMIT_EXCEEDED',
          message: 'You have exceeded your monthly token limit. Please upgrade your plan or wait for the next billing period.',
          redirect: '/pricing',
          subscription: {
            tier: subscription.tier,
            periodEnd: subscription.current_period_end,
            tokenLimit: 500, // Free tier limit
          },
        },
        { status: 429 } // Too Many Requests
      )
    }

    // Check rate limit
    const endpoint = request.nextUrl.pathname
    const withinRateLimit = await checkRateLimit(userId, subscription.tier)

    if (!withinRateLimit) {
      return NextResponse.json(
        {
          error: 'Rate Limit Exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'You have exceeded the daily request limit. Please wait until tomorrow to make more requests.',
          retryAfter: 86400, // 24 hours in seconds
        },
        { status: 429 }
      )
    }

    // Log the request for rate limiting
    await logRequest(userId, endpoint)

    // All checks passed - return subscription info
    return {
      success: true,
      subscription: {
        userId,
        tier: subscription.tier,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        isTrialing: subscription.status === 'trial',
        trialEndsAt: subscription.trial_ends_at,
      },
    }
  } catch (error) {
    console.error('Subscription check error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}

// Helper function to extract error response
export function isSubscriptionError(result: any): result is NextResponse {
  return result instanceof NextResponse || (result && result.error)
}

// Helper to check if user can access premium features
export async function canAccessPremiumFeatures(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId)
  if (!subscription) return false

  return (
    subscription.status === 'active' ||
    (subscription.status === 'trial' &&
      (!subscription.trial_ends_at || new Date() < new Date(subscription.trial_ends_at)))
  )
}

// Get remaining tokens for user
export async function getRemainingTokens(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId)
  if (!subscription) return 0

  const exceededLimit = await hasExceededTokenLimit(userId)
  if (exceededLimit) return 0

  // This would need to be implemented based on your token tracking
  // For now, returning a placeholder
  return 1000
}