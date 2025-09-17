import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { stripe, createStripeCustomer, createCheckoutSession, STRIPE_PRICE_IDS } from '@/lib/stripe-config'
import { SUBSCRIPTION_TIERS, TRIAL_CONFIG } from '@/lib/subscription-tiers'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    const user = await currentUser()

    if (!userId || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { tierId, trial = false } = await request.json()

    if (!tierId || !SUBSCRIPTION_TIERS[tierId]) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      )
    }

    // Check if trial is enabled and user hasn't used it
    if (trial && (!TRIAL_CONFIG.enabled || !TRIAL_CONFIG.requiresPaymentMethod)) {
      return NextResponse.json(
        { error: 'Trial not available' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let customerId: string

    // Check if user already has a Stripe customer ID (you'd need to store this)
    // For now, we'll create a new customer
    const customer = await createStripeCustomer(
      userId,
      user.emailAddresses[0]?.emailAddress || '',
      `${user.firstName} ${user.lastName}`.trim() || undefined
    )
    customerId = customer.id

    // Update customer metadata to include userId
    await stripe.customers.update(customerId, {
      metadata: {
        userId: userId,
      },
    })

    // Get the price ID for the selected tier
    const priceId = STRIPE_PRICE_IDS[tierId as keyof typeof STRIPE_PRICE_IDS]

    if (!priceId || priceId === 'trial') {
      return NextResponse.json(
        { error: 'Invalid price configuration' },
        { status: 500 }
      )
    }

    // Create checkout session
    const successUrl = `${request.headers.get('origin')}/chat?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${request.headers.get('origin')}/pricing`

    const session = await createCheckoutSession(
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      trial && TRIAL_CONFIG.enabled
    )

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Subscribe API error:', error)
    return NextResponse.json(
      { error: 'Failed to create subscription session' },
      { status: 500 }
    )
  }
}