# Going Live with Stripe - From Test to Production

## Current Status
Your application is currently in **TEST MODE** using Stripe test keys. This means:
- Only test card numbers work (like 4242 4242 4242 4242)
- No real money is processed
- All transactions are simulated

## Steps to Go Live with Real Payments

### 1. Activate Your Stripe Account
1. Go to https://dashboard.stripe.com
2. Click on **"Activate your account"** banner at the top
3. Complete the following:
   - Business information (name, address, tax ID)
   - Bank account details (for payouts)
   - Identity verification (personal ID)
   - Business website URL
   - Customer support information

### 2. Get Production API Keys
Once your account is activated:
1. Go to **Developers → API keys** in Stripe Dashboard
2. You'll see two sets of keys:
   - **Test keys** (what you're using now)
   - **Live keys** (for real payments)
3. Copy your **Live keys**:
   - Publishable key: `pk_live_...`
   - Secret key: `sk_live_...`

### 3. Create Live Products and Prices
1. Switch to **Live mode** in Stripe Dashboard (toggle at top)
2. Go to **Products**
3. Create your three subscription tiers again:
   - Starter ($10/month)
   - Premium ($50/month)
   - Limitless ($150/month)
4. Copy the new price IDs (they'll be different from test ones)

### 4. Update Environment Variables

#### Local Development (.env.local)
```env
# Replace test keys with live keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY

# Update with live price IDs
STRIPE_STARTER_PRICE_ID=price_live_starter_id
STRIPE_PREMIUM_PRICE_ID=price_live_premium_id
STRIPE_LIMITLESS_PRICE_ID=price_live_limitless_id
```

#### Production (Vercel)
Update all Stripe environment variables in Vercel:
```bash
# Remove test keys
vercel env rm NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
vercel env rm STRIPE_SECRET_KEY
vercel env rm STRIPE_STARTER_PRICE_ID
vercel env rm STRIPE_PREMIUM_PRICE_ID
vercel env rm STRIPE_LIMITLESS_PRICE_ID

# Add live keys
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_STARTER_PRICE_ID production
vercel env add STRIPE_PREMIUM_PRICE_ID production
vercel env add STRIPE_LIMITLESS_PRICE_ID production
```

### 5. Set Up Production Webhooks
1. In Stripe Dashboard (Live mode), go to **Developers → Webhooks**
2. Click **"Add endpoint"**
3. Enter your production URL:
   ```
   https://your-domain.vercel.app/api/webhook/stripe
   ```
4. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.trial_will_end`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Update `STRIPE_WEBHOOK_SECRET` in Vercel:
   ```bash
   vercel env add STRIPE_WEBHOOK_SECRET production
   ```

### 6. Deploy to Production
```bash
vercel --prod
```

## Important Considerations

### Security
- **NEVER** commit live keys to GitHub
- Always use environment variables
- Keep your webhook endpoint secure
- Enable Stripe's security features:
  - Radar for fraud protection
  - 3D Secure for additional authentication

### Testing in Production
- Create a small test subscription with your own card
- Verify webhook events are being received
- Check database updates are working
- Test the full customer journey

### Compliance
- Add Terms of Service and Privacy Policy
- Include refund policy
- Display pricing clearly
- Add proper payment disclosures

### Customer Support
- Set up customer support email
- Configure Stripe Customer Portal for self-service
- Enable subscription management (cancel, upgrade, downgrade)

## Stripe Dashboard Features

### Customer Portal
Enable customers to manage their own subscriptions:
1. Go to **Settings → Customer portal**
2. Configure:
   - Allow customers to cancel subscriptions
   - Update payment methods
   - Download invoices
   - View billing history

### Email Receipts
1. Go to **Settings → Customer emails**
2. Enable automatic receipt emails
3. Customize email templates with your branding

### Tax Collection (if needed)
1. Go to **Settings → Tax**
2. Enable Stripe Tax
3. Configure tax rates for your regions

## Monitoring

### Key Metrics to Watch
- **Successful payment rate** - Should be >95%
- **Failed payments** - Monitor and follow up
- **Churn rate** - Track cancellations
- **MRR (Monthly Recurring Revenue)** - Track growth

### Stripe Reports
- Use Stripe Sigma for SQL queries
- Set up automated reports
- Monitor dispute rates (keep <1%)

## Troubleshooting Common Issues

### "Your account cannot currently make live charges"
- Complete account activation
- Verify all required information submitted
- Check for any pending verifications

### Webhooks not working
- Verify endpoint URL is correct
- Check webhook signing secret
- Look at webhook logs in Stripe Dashboard

### Payment failures
- Enable automatic retries
- Set up dunning emails
- Configure grace periods

## Support Resources
- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- API Reference: https://stripe.com/docs/api
- Testing Guide: https://stripe.com/docs/testing

## Final Checklist
- [ ] Stripe account activated
- [ ] Live API keys obtained
- [ ] Products created in live mode
- [ ] Environment variables updated
- [ ] Production webhook configured
- [ ] Customer portal enabled
- [ ] Terms of Service added
- [ ] Privacy Policy added
- [ ] Test transaction completed
- [ ] Customer support email configured

Once all items are checked, you're ready to accept real payments! 🎉