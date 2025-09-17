# Clerk Production Setup Guide

## Current Status
Your Clerk is currently in **development mode** using test keys.

## Steps to Move to Production

### 1. In Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your Infinet application
3. Look for **"Deploy to Production"** button or toggle
4. Configure your production domain:
   - Add your Vercel domain (e.g., `infinet.vercel.app`)
   - Add any custom domains you're using

### 2. Get Production Keys

Once in production mode:
1. Go to **API Keys** section
2. Copy your new production keys:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_live_`)
   - `CLERK_SECRET_KEY` (starts with `sk_live_`)

### 3. Update Environment Variables

#### Local Development (.env.local)
Replace the test keys with production keys:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_KEY_HERE
CLERK_SECRET_KEY=sk_live_YOUR_KEY_HERE
```

#### Vercel Dashboard
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Update both Clerk keys with the production values
4. Make sure they're set for all environments (Production, Preview, Development)

### 4. Additional Production Settings

In Clerk Dashboard, configure:
- **Allowed Redirect URLs**: Add your production URLs
- **Webhook Endpoints**: If you're using webhooks
- **Social Login**: Configure OAuth providers if needed
- **Email/SMS**: Set up production email/SMS providers

### 5. Test Production Setup

1. Clear your browser cookies/cache
2. Try signing up with a new account
3. Verify sign-in works correctly
4. Check that users can access the chat interface

## Important Notes

- **Keep development keys**: You might want to create a separate Clerk app for development
- **Domain verification**: Clerk may require domain verification for production
- **Rate limits**: Production has different rate limits than development
- **Support**: Production apps get priority support from Clerk

## Troubleshooting

If sign-in redirects aren't working:
- Check that your production domain is added in Clerk
- Verify redirect URLs are configured correctly
- Ensure environment variables are properly set in Vercel

If you see "Development mode" banner:
- Make sure you're using production keys
- Clear browser cache
- Check that Vercel has the updated environment variables