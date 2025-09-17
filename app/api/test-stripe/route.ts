import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe-config'

export async function GET() {
  try {
    // Test if we can connect to Stripe
    const products = await stripe.products.list({ limit: 1 })

    // Test if we can retrieve prices
    const prices = await stripe.prices.list({ limit: 10 })

    return NextResponse.json({
      success: true,
      stripe_connected: true,
      products_count: products.data.length,
      prices: prices.data.map(p => ({
        id: p.id,
        product: p.product,
        unit_amount: p.unit_amount,
        currency: p.currency
      })),
      env_check: {
        has_secret_key: !!process.env.STRIPE_SECRET_KEY,
        has_publishable_key: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        starter_price: process.env.STRIPE_STARTER_PRICE_ID || 'NOT SET',
        premium_price: process.env.STRIPE_PREMIUM_PRICE_ID || 'NOT SET',
        limitless_price: process.env.STRIPE_LIMITLESS_PRICE_ID || 'NOT SET',
      }
    })
  } catch (error) {
    console.error('Stripe test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      env_check: {
        has_secret_key: !!process.env.STRIPE_SECRET_KEY,
        has_publishable_key: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      }
    }, { status: 500 })
  }
}