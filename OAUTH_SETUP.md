# OAuth Social Providers Setup

## Google OAuth

### 1. Create Google OAuth Credentials
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized redirect URIs (add ALL of these):
   - `https://clerk.infiniteai.org/v1/oauth_callback`
   - `https://infiniteai.org/sign-in/sso-callback/oauth_google`
   - `https://infiniteai.org/sign-up/sso-callback/oauth_google`
   - `https://www.infiniteai.org/sign-in/sso-callback/oauth_google`
   - `https://www.infiniteai.org/sign-up/sso-callback/oauth_google`

### 2. In Clerk Dashboard
1. Go to User & Authentication → Social Connections → Google
2. Toggle "Use custom credentials"
3. Add your Client ID and Secret
4. Make sure it's enabled for Production

## GitHub OAuth (Optional)

### 1. Create GitHub OAuth App
1. Go to: https://github.com/settings/developers
2. New OAuth App
3. Settings:
   - Application name: Infinet
   - Homepage URL: https://infiniteai.org
   - Authorization callback URL: `https://clerk.infiniteai.org/v1/oauth_callback`

### 2. In Clerk Dashboard
1. Go to User & Authentication → Social Connections → GitHub
2. Toggle "Use custom credentials"
3. Add your Client ID and Secret

## Important Notes

- Each provider needs its own Client ID and Secret
- The redirect URIs must match EXACTLY
- After adding credentials, it takes 1-2 minutes to propagate
- Test with incognito/private browsing to avoid cache issues

## Troubleshooting

If you get "client_id" errors:
1. Double-check the Client ID is correctly pasted in Clerk
2. Ensure the provider is enabled for Production
3. Verify redirect URIs match exactly
4. Clear browser cache and try again