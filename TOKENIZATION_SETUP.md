# Infinet Tokenization System Setup

## Overview
Infinet is a premium, paid-only AI service with NO FREE TIER. Users must pay to access any features. This document explains how to set up the complete tokenization and subscription system.

## System Features

### Subscription Tiers
1. **Starter Tier ($10/month)**
   - 10,000 tokens per month
   - 30 requests per hour limit
   - Standard processing
   - Community support
   - Text chat only
   - Basic AI models

2. **Premium Tier ($50/month)**
   - 50,000 tokens per month
   - 60 requests per hour limit
   - Standard processing
   - Email support
   - All AI models access
   - Image generation included

3. **Limitless Tier ($150/month)**
   - 100,000 tokens per month
   - Unlimited requests per hour
   - Priority processing
   - Priority support
   - Advanced analytics
   - API access

### Key Policies
- ❌ NO FREE TIER - Payment required immediately
- ❌ NO TOKEN ROLLOVER - Unused tokens expire
- ❌ NO OVERAGES - Hard stop at token limit
- ✅ IMMEDIATE PAYWALL - Blocks all features without subscription
- ✅ MONTHLY RESET - Based on billing cycle, not calendar month
- ✅ USAGE TRACKING - Real-time token counting

## Setup Instructions

### 1. Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Get your API keys from the Stripe Dashboard
3. Create three products:
   - Starter: $10/month
   - Premium: $50/month
   - Limitless: $150/month
4. Copy the price IDs for each product
5. Set up webhook endpoint: `https://yourdomain.com/api/webhook/stripe`
6. Configure webhook to send these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### 2. Vercel Postgres Setup

1. In your Vercel dashboard, add Postgres:
   ```
   Settings > Storage > Create Database > Postgres
   ```

2. Copy all the environment variables provided

3. Run the database schema:
   ```sql
   -- Execute the contents of lib/database/schema.sql
   ```

### 3. Environment Variables

Add these to your `.env.local` file:

```env
# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_LIMITLESS_PRICE_ID=price_...

# Database (from Vercel)
POSTGRES_URL=...
POSTGRES_PRISMA_URL=...
POSTGRES_URL_NON_POOLING=...
POSTGRES_USER=...
POSTGRES_HOST=...
POSTGRES_PASSWORD=...
POSTGRES_DATABASE=...
```

### 4. Deploy to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add all environment variables
4. Deploy

## User Flow

### New User Journey
1. User signs up with Clerk
2. IMMEDIATELY redirected to `/pricing` (paywall)
3. Must select a plan and enter payment info
4. Only after successful payment → access to `/chat`

### Token Usage Flow
1. User types message
2. Client estimates tokens BEFORE sending
3. Shows warning if would exceed limit
4. Server validates subscription on EVERY request
5. Tracks actual tokens used
6. Updates usage display in real-time

### Limit Enforcement
- 80% usage: Yellow warning
- 90% usage: Orange warning, upgrade prompt
- 95% usage: Red warning on every message
- 100% usage: COMPLETE BLOCK, must upgrade or wait

## Token Calculation

### What Counts as Tokens
- Text input: ~1 token per 4 characters
- AI response: ~1 token per 4 characters
- Image generation: 500 tokens per image
- File processing: 200 tokens per file

### Monthly Allowances
- Starter (10,000): ~100 typical conversations
- Premium (50,000): ~500 typical conversations
- Limitless (100,000): ~1,000 typical conversations

## Testing the System

### Test Scenarios
1. **New User Paywall**
   - Sign up → Should redirect to pricing
   - Try to access /chat → Should block

2. **Token Limits**
   - Use 95% of tokens → Should show red warning
   - Use 100% → Should completely block

3. **Payment Failure**
   - Cancel card → Should suspend access after 3 days
   - Update payment → Should restore access

4. **Upgrade/Downgrade**
   - Upgrade mid-month → Should prorate and add tokens
   - Downgrade → Should schedule for next period

## API Endpoints

### Subscription Management
- `POST /api/subscribe` - Create new subscription
- `POST /api/upgrade` - Upgrade/downgrade plan
- `POST /api/cancel` - Cancel subscription
- `GET /api/usage` - Get current usage stats

### Webhook
- `POST /api/webhook/stripe` - Handle Stripe events

## Database Tables

### users_subscription
- Stores subscription status
- Links Clerk user to Stripe customer
- Tracks billing periods

### token_usage
- Records every API call
- Tracks tokens per message
- Used for billing and analytics

### monthly_usage_cache
- Cached usage totals
- Quick lookup for UI
- Updated after each API call

## Monitoring & Alerts

### User Alerts
- 80% usage: Email warning
- 90% usage: Urgent email
- 100% usage: Block notification
- Payment failed: Grace period warning

### Admin Monitoring
- Daily usage reports
- Failed payment alerts
- Unusual usage patterns
- Subscription metrics

## Common Issues

### "No subscription found"
- User hasn't completed Stripe checkout
- Webhook didn't fire properly
- Check Stripe dashboard for customer

### "Token limit exceeded"
- User at 100% of monthly limit
- Must upgrade or wait for reset
- Check usage in database

### "Payment required"
- Subscription expired/canceled
- Payment method failed
- User in grace period

## Support Contact

For issues with the tokenization system:
- Technical: Check Stripe logs and database
- Billing: Review Stripe customer portal
- Usage: Check token_usage table

Remember: This is a PREMIUM service with NO FREE ACCESS. All features require payment.