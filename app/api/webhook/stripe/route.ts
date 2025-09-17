import { NextRequest, NextResponse } from 'next/server'
import { stripe, verifyWebhookSignature, STRIPE_WEBHOOK_EVENTS } from '@/lib/stripe-config'
import { upsertSubscription } from '@/lib/database/db'
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

        // Get user ID from metadata
        const userId = subscription.metadata?.userId

        if (!userId) {
          console.error('No userId in subscription metadata')
          return NextResponse.json(
            { error: 'Missing user ID in subscription' },
            { status: 400 }
          )
        }

        // Map Stripe status to our status
        let status: 'active' | 'canceled' | 'past_due' | 'trial' | 'suspended'
        switch (subscription.status) {
          case 'active':
            status = 'active'
            break
          case 'past_due':
            status = 'past_due'
            break
          case 'canceled':
          case 'unpaid':
            status = 'canceled'
            break
          case 'trialing':
            status = 'trial'
            break
          default:
            status = 'suspended'
        }

        // Save to database
        await upsertSubscription({
          user_id: userId,
          tier,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          status,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : undefined,
        })

        console.log(`Subscription ${event.type === STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_CREATED ? 'created' : 'updated'} for user ${userId}`)
        break
      }

      case STRIPE_WEBHOOK_EVENTS.SUBSCRIPTION_DELETED: {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.userId

        if (!userId) {
          console.error('No userId in subscription metadata')
          return NextResponse.json(
            { error: 'Missing user ID in subscription' },
            { status: 400 }
          )
        }

        // Update subscription status to canceled
        await upsertSubscription({
          user_id: userId,
          tier: 'starter', // Default tier, doesn't matter since it's canceled
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          status: 'canceled',
        })

        console.log(`Subscription canceled for user ${userId}`)
        break
      }

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED: {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const userId = subscription.metadata?.userId

          if (userId) {
            // Update subscription status to past_due
            await upsertSubscription({
              user_id: userId,
              tier: 'starter', // Will be overridden by actual tier
              stripe_customer_id: subscription.customer as string,
              stripe_subscription_id: subscription.id,
              current_period_start: new Date(subscription.current_period_start * 1000),
              current_period_end: new Date(subscription.current_period_end * 1000),
              status: 'past_due',
            })

            console.log(`Payment failed for user ${userId}`)
          }
        }
        break
      }

      case STRIPE_WEBHOOK_EVENTS.TRIAL_WILL_END: {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.userId

        if (userId) {
          console.log(`Trial ending soon for user ${userId}`)
          // You could send an email notification here
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