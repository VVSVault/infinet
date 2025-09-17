# Complete Stripe Integration Guide for Infinet

This guide will walk you through setting up Stripe for your Infinet subscription system.

## Step 1: Create Stripe Account

1. Go to https://stripe.com
2. Click "Start now" or "Sign up"
3. Fill in your business details
4. Verify your email

## Step 2: Get Your API Keys

1. Once logged into Stripe Dashboard: https://dashboard.stripe.com
2. Look for "Developers" in the left sidebar
3. Click on "API keys"
4. You'll see two types of keys:
   - **Publishable key**: Starts with `pk_test_` (for frontend)
   - **Secret key**: Starts with `sk_test_` (for backend)

5. Copy both keys and save them for later

## Step 3: Create Products and Prices

### In Stripe Dashboard:

1. Go to "Products" in the left sidebar
2. Click "Add product"

### Create Starter Tier:
- **Name**: Infinet Starter
- **Description**: 10,000 tokens per month
- **Pricing**:
  - Recurring
  - $10.00 USD
  - Monthly
- Click "Save product"
- Copy the price ID (starts with `price_`)

### Create Premium Tier:
- **Name**: Infinet Premium
- **Description**: 50,000 tokens per month
- **Pricing**:
  - Recurring
  - $50.00 USD
  - Monthly
- Click "Save product"
- Copy the price ID

### Create Limitless Tier:
- **Name**: Infinet Limitless
- **Description**: 100,000 tokens per month
- **Pricing**:
  - Recurring
  - $150.00 USD
  - Monthly
- Click "Save product"
- Copy the price ID

## Step 4: Set Up Webhooks

1. In Stripe Dashboard, go to "Developers" → "Webhooks"
2. Click "Add endpoint"
3. **Endpoint URL**:
   - Local testing: Use ngrok or similar (see below)
   - Production: `https://your-domain.vercel.app/api/webhook/stripe`

4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.trial_will_end`

5. Click "Add endpoint"
6. After creation, click on the webhook
7. Click "Reveal" under "Signing secret"
8. Copy the webhook secret (starts with `whsec_`)

## Step 5: Local Testing with Stripe CLI

### Install Stripe CLI:

**Windows (using Scoop):**
```bash
scoop install stripe
```

**Mac:**
```bash
brew install stripe/stripe-cli/stripe
```

**Or download directly:** https://stripe.com/docs/stripe-cli#install

### Login to Stripe CLI:
```bash
stripe login
```

### Forward webhooks to localhost:
```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

This will give you a webhook signing secret for local testing.

## Step 6: Update Environment Variables

Update your `.env.local` file:

```env
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
STRIPE_STARTER_PRICE_ID=price_YOUR_STARTER_PRICE_ID
STRIPE_PREMIUM_PRICE_ID=price_YOUR_PREMIUM_PRICE_ID
STRIPE_LIMITLESS_PRICE_ID=price_YOUR_LIMITLESS_PRICE_ID
```

## Step 7: Set Up Database (if not done)

### Using Vercel Postgres:

1. Go to your Vercel Dashboard
2. Select your project
3. Go to "Storage" tab
4. Click "Create Database" → "Postgres"
5. Copy all the environment variables provided
6. Add them to your `.env.local`

### Run the schema:

Create a script to initialize your database:

```javascript
// scripts/init-db.js
const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function initDb() {
  try {
    const schema = fs.readFileSync(
      path.join(__dirname, '../lib/database/schema.sql'),
      'utf8'
    );

    // Execute the schema
    await sql.query(schema);
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

initDb();
```

Run it:
```bash
node scripts/init-db.js
```

## Step 8: Test the Integration

### 1. Test Subscription Creation:

```bash
# In one terminal, run your app:
npm run dev

# In another terminal, forward webhooks:
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

### 2. Go through the flow:
1. Sign up/login at http://localhost:3000
2. You should be redirected to pricing
3. Select a plan
4. Complete checkout (use test card: 4242 4242 4242 4242)
5. Check your database for the subscription

### Test Cards:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires authentication**: 4000 0025 0000 3155

## Step 9: Production Deployment

### On Vercel:

1. Go to your project settings
2. Go to "Environment Variables"
3. Add all the Stripe environment variables:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (all environments)
   - `STRIPE_SECRET_KEY` (production only)
   - `STRIPE_WEBHOOK_SECRET` (production only)
   - `STRIPE_STARTER_PRICE_ID` (production only)
   - `STRIPE_PREMIUM_PRICE_ID` (production only)
   - `STRIPE_LIMITLESS_PRICE_ID` (production only)

4. Add database environment variables (from Vercel Postgres)

5. Deploy your application

### Update Stripe Webhook:

1. Go back to Stripe Dashboard → Webhooks
2. Update your webhook URL to production URL
3. Get the new webhook secret
4. Update it in Vercel environment variables

## Step 10: Go Live

When ready for real payments:

1. In Stripe Dashboard, toggle from "Test mode" to "Live mode"
2. Get your live API keys
3. Create products and prices in live mode
4. Update all environment variables with live keys
5. Update webhook with live endpoint and secret

## Troubleshooting

### Common Issues:

**"No subscription found"**
- Check if webhook is properly configured
- Verify webhook secret is correct
- Check Stripe Dashboard logs

**"Payment required" after payment**
- Database might not be connected
- Webhook might not be firing
- Check browser console and server logs

**Webhook signature verification failed**
- Wrong webhook secret
- Body parsing issue (make sure it's disabled for webhook route)

### Debugging:

1. Check Stripe Dashboard → Developers → Logs
2. Check webhook attempts in Stripe Dashboard
3. Use `console.log` in webhook handler
4. Check Vercel Functions logs

## Testing Checklist

- [ ] Can create Stripe customer
- [ ] Can create checkout session
- [ ] Webhook receives events
- [ ] Database updates on subscription
- [ ] Token limits enforced
- [ ] Payment failure handled
- [ ] Subscription cancellation works
- [ ] Upgrade/downgrade works

## Support Resources

- Stripe Docs: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- Test card numbers: https://stripe.com/docs/testing
- Webhook debugging: https://stripe.com/docs/webhooks/test

Remember: Start in test mode, verify everything works, then switch to live mode!