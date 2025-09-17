import { NextRequest, NextResponse } from 'next/server'
import { stripe, verifyWebhookSignature, STRIPE_WEBHOOK_EVENTS } from '@/lib/stripe-config'
import {
  getUserByClerkId,
  getUserByStripeCustomerId,
  updateUserSubscription,
  logSubscriptionEvent,
  resetMonthlyUsage
} from '@/lib/database'
import { SUBSCRIPTION_TIERS } from '@/lib/subscription-tiers'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.error('Missing STRIPE_WEBHOOK_SECRET')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    let event: Stripe.Event

    try {
      event = verifyWebhookSignature(body, signature, webhookSecret)
    } catch (error: any) {
      console.error('Webhook signature verification failed:', error.message)
      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 }
      )
    }

    console.log(`Processing webhook event: ${event.type}`)

    switch (event.type) {
      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED:
      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED: {
        const subscription = event.data.object as Stripe.Subscription

        // Get the price ID to determine tier
        const priceId = subscription.items.data[0]?.price.id
        let tier: 'starter' | 'premium' | 'limitless' = 'starter'

        // Map price ID to tier
        if (priceId === process.env.STRIPE_STARTER_PRICE_ID) {
          tier = 'starter'
        } else if (priceId === process.env.STRIPE_PREMIUM_PRICE_ID) {
          tier = 'premium'
        } else if (priceId === process.env.STRIPE_LIMITLESS_PRICE_ID) {
          tier = 'limitless'
        }

        // Get user by stripe customer ID
        const user = await getUserByStripeCustomerId(subscription.customer as string)

        if (!user) {
          console.error('No user found for Stripe customer:', subscription.customer)
          return NextResponse.json(
            { error: 'User not found for customer' },
            { status: 400 }
          )
        }

        // Map Stripe status to our status
        let status: 'active' | 'inactive' | 'canceled' | 'past_due'
        switch (subscription.status) {
          case 'active':
          case 'trialing':
            status = 'active'
            break
          case 'past_due':
            status = 'past_due'
            break
          case 'canceled':
          case 'unpaid':
            status = 'canceled'
            break
          default:
            status = 'inactive'
        }

        // Get token limit for the tier
        const tokenLimit = SUBSCRIPTION_TIERS[tier]?.tokenLimit || 0

        // Update user subscription
        await updateUserSubscription(user.id, {
          subscription_tier: tier,
          subscription_status: status,
          stripe_subscription_id: subscription.id,
          tokens_limit: tokenLimit,
          subscription_period_start: new Date((subscription as any).current_period_start * 1000),
          subscription_period_end: new Date((subscription as any).current_period_end * 1000),
        })

        // If it's a new period, reset usage
        if (event.type === STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED) {
          const periodStart = new Date((subscription as any).current_period_start * 1000)
          if (user.subscription_period_start && periodStart > user.subscription_period_start) {
            await resetMonthlyUsage(user.id)
          }
        }

        // Log the event
        await logSubscriptionEvent(
          user.id,
          event.type,
          tier,
          status,
          event.id,
          { price_id: priceId }
        )

        console.log(`Subscription ${event.type === STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED ? 'created' : 'updated'} for user ${user.email}`)
        break
      }

      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED: {
        const subscription = event.data.object as Stripe.Subscription

        // Get user by stripe customer ID
        const user = await getUserByStripeCustomerId(subscription.customer as string)

        if (!user) {
          console.error('No user found for Stripe customer:', subscription.customer)
          return NextResponse.json(
            { error: 'User not found for customer' },
            { status: 400 }
          )
        }

        // Update subscription status to canceled and reset to free tier
        await updateUserSubscription(user.id, {
          subscription_tier: 'free',
          subscription_status: 'inactive',
          stripe_subscription_id: subscription.id,
          tokens_limit: 0,
          subscription_period_end: new Date((subscription as any).current_period_end * 1000),
        })

        // Log the event
        await logSubscriptionEvent(
          user.id,
          event.type,
          'free',
          'canceled',
          event.id,
          { previous_subscription_id: subscription.id }
        )

        console.log(`Subscription canceled for user ${user.email}`)
        break
      }

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED: {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as any).subscription as string

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)

          // Get user by stripe customer ID
          const user = await getUserByStripeCustomerId(subscription.customer as string)

          if (user) {
            // Update subscription status to past_due
            await updateUserSubscription(user.id, {
              subscription_status: 'past_due',
            })

            // Log the event
            await logSubscriptionEvent(
              user.id,
              event.type,
              user.subscription_tier,
              'past_due',
              event.id,
              { invoice_id: invoice.id, attempt_count: invoice.attempt_count }
            )

            console.log(`Payment failed for user ${user.email}`)
          }
        }
        break
      }

      case STRIPE_WEBHOOK_EVENTS.TRIAL_WILL_END: {
        const subscription = event.data.object as Stripe.Subscription

        // Get user by stripe customer ID
        const user = await getUserByStripeCustomerId(subscription.customer as string)

        if (user) {
          console.log(`Trial ending soon for user ${user.email}`)
          // You could send an email notification here

          // Log the event
          await logSubscriptionEvent(
            user.id,
            event.type,
            user.subscription_tier,
            user.subscription_status,
            event.id,
            { trial_end: subscription.trial_end }
          )
        }
        break
      }

      case STRIPE_WEBHOOK_EVENTS.PAYMENT_SUCCEEDED: {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log(`Payment succeeded: ${paymentIntent.id}`)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Stripe requires raw body, so we need to disable body parsing
export const config = {
  api: {
    bodyParser: false,
  },
}