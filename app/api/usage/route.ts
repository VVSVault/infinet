import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getMonthlyUsage, getUserSubscription } from '@/lib/database/db'
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user subscription
    const subscription = await getUserSubscription(userId)

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      )
    }

    // Get monthly usage
    const usage = await getMonthlyUsage(userId)

    if (!usage) {
      // Return default values if no usage yet
      const tierInfo = SUBSCRIPTION_TIERS[subscription.tier] || SUBSCRIPTION_TIERS.premium
      return NextResponse.json({
        tokensUsed: 0,
        tokenLimit: tierInfo.tokenLimit,
        tokensRemaining: tierInfo.tokenLimit,
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
        tier: subscription.tier,
        status: subscription.status,
      })
    }

    return NextResponse.json({
      tokensUsed: usage.total_tokens,
      tokenLimit: SUBSCRIPTION_TIERS[subscription.tier]?.tokenLimit || 0,
      tokensRemaining: usage.tokens_remaining,
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
      tier: subscription.tier,
      status: subscription.status,
      totalRequests: usage.total_requests,
      lastUpdated: usage.last_updated,
    })
  } catch (error) {
    console.error('Usage API error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}