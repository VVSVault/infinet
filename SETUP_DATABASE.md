# Setting Up Vercel Postgres Database

## Step 1: Create the Database in Vercel Dashboard

1. **Go to your Vercel dashboard**: https://vercel.com/dashboard
2. **Select your "infinet" project**
3. **Click on the "Storage" tab**
4. **Click "Create Database"** and select **"Postgres"**
5. **Name your database** (e.g., "infinet-db")
6. **Select your region** (choose one close to your users)
7. **Click "Create"**

## Step 2: Pull Environment Variables

Once the database is created, Vercel will automatically add the connection strings to your project. Pull them locally:

```bash
vercel env pull .env.local
```

This will add the following variables to your `.env.local`:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

## Step 3: Initialize the Database Schema

Run the setup script to create tables:

```bash
node scripts/setup-database.js
```

## Step 4: Add Stripe Environment Variables to Vercel

Add your Stripe keys to Vercel for production:

```bash
# Add Stripe public key
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Add Stripe secret key
vercel env add STRIPE_SECRET_KEY

# Add Stripe webhook secret (you'll get this from Stripe Dashboard)
vercel env add STRIPE_WEBHOOK_SECRET

# Add Price IDs
vercel env add STRIPE_STARTER_PRICE_ID
vercel env add STRIPE_PREMIUM_PRICE_ID
vercel env add STRIPE_LIMITLESS_PRICE_ID
```

## Step 5: Configure Stripe Webhooks for Production

1. Go to your Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to **Developers → Webhooks**
3. Click **"Add endpoint"**
4. Enter your endpoint URL: `https://your-vercel-app.vercel.app/api/webhook/stripe`
5. Select these events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
6. Copy the **Signing secret** and update `STRIPE_WEBHOOK_SECRET` in Vercel

## Database Schema

The database includes three main tables:

### `users` table
- Stores user subscription information
- Links Clerk user IDs with Stripe customer IDs
- Tracks token usage and limits

### `usage_logs` table
- Records each API call's token usage
- Helps track usage patterns

### `subscription_history` table
- Maintains audit trail of subscription changes
- Stores webhook events for debugging

## Testing the Setup

After setup, you can test with:

```bash
# Test database connection
node -e "const { sql } = require('@vercel/postgres'); sql\`SELECT NOW()\`.then(r => console.log('Connected!', r.rows[0]))"

# Check tables
node -e "const { sql } = require('@vercel/postgres'); sql\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\`.then(r => console.log('Tables:', r.rows))"
```

## Deployment

Deploy your updated application:

```bash
vercel --prod
```

Your application will now use the Postgres database for subscription management!