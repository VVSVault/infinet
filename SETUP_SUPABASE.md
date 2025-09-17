# Setting Up Supabase Database for Infinet

## Prerequisites
You need a Supabase account and project. If you don't have one, create it at https://supabase.com

## Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings → API**
3. Copy the following values:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **Service Role Key** (under "Service role - secret")

## Step 2: Add Environment Variables

Add these to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Step 3: Create Database Tables

### Option A: Using Supabase Dashboard SQL Editor

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `scripts/setup-supabase.sql`
5. Click **Run**

### Option B: Using the Script

After adding your environment variables, run:

```bash
node scripts/setup-supabase.js
```

## Step 4: Verify the Setup

The database should now have these tables:
- **users** - Stores user subscription and token information
- **usage_logs** - Tracks API usage per request
- **subscription_history** - Audit log of subscription changes

## Step 5: Test the Connection

You can test the connection with this command:

```bash
node -e "const { createClient } = require('@supabase/supabase-js'); const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); supabase.from('users').select('count').then(r => console.log('Connected! Users:', r.data))"
```

## Database Schema Overview

### Users Table
- Links Clerk authentication with Stripe subscriptions
- Tracks token usage and limits per user
- Manages subscription periods

### Usage Logs Table
- Records every API call's token consumption
- Differentiates between chat and image generation
- Helps with usage analytics

### Subscription History Table
- Maintains complete audit trail
- Stores Stripe webhook events
- Useful for debugging subscription issues

## Row Level Security (RLS)

The tables have RLS enabled with policies that allow full access for the service role key. This ensures that only your backend can modify the data.

## Next Steps

1. Deploy to production with `vercel --prod`
2. Add the Supabase environment variables to Vercel:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL production
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   ```

Your Supabase database is now ready to handle subscriptions and usage tracking!