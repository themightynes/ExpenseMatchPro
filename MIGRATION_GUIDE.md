# Clerk Authentication Migration Guide

## Overview

This application has been migrated from Passport.js with Google OAuth to Clerk authentication. All existing functionality and database structure have been preserved.

## What Changed

### Backend Changes

1. **New File: `server/clerkAuth.ts`**
   - Replaces `server/googleAuth.ts` functionality
   - Implements Clerk middleware and webhook handler
   - Maintains compatibility with existing storage methods
   - Stores Clerk user IDs in the existing `googleId` field

2. **Updated Files**
   - `server/routes.ts`: Now uses `setupClerkAuth` and `clerkMiddleware`
   - `server/index.ts`: Updated middleware ordering for Clerk compatibility

3. **Middleware Changes**
   - `requireAuth` middleware now validates Clerk sessions
   - User data is still attached to `req.user` for backward compatibility
   - Authorization check still enforces single email restriction

### Frontend Changes

1. **Updated Files**
   - `client/src/main.tsx`: Wrapped app with `<ClerkProvider>`
   - `client/src/hooks/useAuth.ts`: Now uses Clerk hooks (`useUser`, `useClerk`)
   - `client/src/components/AuthGuard.tsx`: Uses Clerk `<SignIn>` and `<UserButton>` components
   - `client/src/components/MobileHeader.tsx`: Added `<UserButton>` for profile/logout

2. **Authentication Flow**
   - Users sign in via Clerk's hosted UI
   - Clerk webhooks sync user data to PostgreSQL database
   - Authorization check happens on backend using existing `isAuthorized` flag

## Database Schema

**NO CHANGES** - The existing database schema is fully preserved:

- `users` table remains unchanged
- `googleId` field now stores Clerk user IDs
- All relationships and data are maintained
- Existing user data is preserved

## Environment Variables

### Required New Variables

Add these to your `.env` file:

```bash
# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

### Frontend Environment Variable

Add to your Vite environment (`.env` or Replit Secrets as `VITE_CLERK_PUBLISHABLE_KEY`):

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Variables No Longer Needed

These can be removed once migration is complete:

```bash
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SESSION_SECRET
```

### Variables Still Required

```bash
DATABASE_URL=postgresql://...
AUTHORIZED_EMAIL=ernesto.chapa@gmail.com
```

## Setup Instructions

### 1. Create Clerk Account and Application

1. Sign up at [https://clerk.com](https://clerk.com)
2. Create a new application
3. Enable Google as an authentication provider (Settings → Authentication → Social Connections)
4. Copy the publishable and secret keys from the Clerk dashboard

### 2. Configure Clerk Webhook

1. In Clerk dashboard, go to Webhooks
2. Create a new webhook endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the webhook signing secret

### 3. Configure Environment Variables

#### On Replit:

1. Open Secrets (Tools → Secrets)
2. Add the following secrets:
   ```
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   CLERK_WEBHOOK_SECRET=whsec_...
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...  (same as CLERK_PUBLISHABLE_KEY)
   ```
3. Keep `AUTHORIZED_EMAIL=ernesto.chapa@gmail.com`
4. Keep `DATABASE_URL` as is

#### On Local Development:

Create/update `.env` file:
```bash
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
AUTHORIZED_EMAIL=ernesto.chapa@gmail.com
DATABASE_URL=postgresql://...
```

### 4. Install Dependencies

Dependencies have already been installed:
- `@clerk/clerk-sdk-node` (backend)
- `@clerk/clerk-react` (frontend)
- `svix` (webhook signature verification)

If needed, reinstall:
```bash
npm install
```

### 5. Test the Migration

1. Start the application:
   ```bash
   npm run dev
   ```

2. Open the application in your browser

3. You should see Clerk's sign-in interface

4. Sign in with the authorized email (`ernesto.chapa@gmail.com`)

5. After signing in:
   - Clerk webhook will sync user to database
   - Backend will check authorization
   - If authorized, you'll see the dashboard
   - If not authorized, you'll see "Access Denied"

### 6. Verify Database Sync

Check that the user was synced to your database:

```sql
SELECT id, email, name, "googleId", "isAuthorized", "lastLoginAt"
FROM users
WHERE email = 'ernesto.chapa@gmail.com';
```

The `googleId` field should contain the Clerk user ID (starts with `user_`).

## Authorization Flow

1. **User signs in via Clerk** → Clerk validates credentials
2. **Clerk webhook fires** → Syncs user to database with authorization check
3. **Frontend makes API call** → Backend validates Clerk session token
4. **Backend checks authorization** → Queries database for `isAuthorized` flag
5. **Access granted/denied** → Based on `AUTHORIZED_EMAIL` match

## Single Email Restriction

The single authorized email restriction (`ernesto.chapa@gmail.com`) is enforced in two places:

1. **Webhook Handler** (`server/clerkAuth.ts`):
   - When user is created/updated, `isAuthorized` is set based on email match
   - Only the authorized email gets `isAuthorized: true`

2. **Request Middleware** (`requireAuth` in `server/clerkAuth.ts`):
   - Checks `user.isAuthorized` before allowing API access
   - Returns 403 if user is not authorized

To change the authorized email, update the `AUTHORIZED_EMAIL` environment variable.

## Removing Old Auth Code (Optional)

Once you've verified Clerk is working correctly, you can optionally remove:

1. `server/googleAuth.ts` - old Passport configuration
2. Dependencies:
   ```bash
   npm uninstall passport passport-google-oauth20 express-session connect-pg-simple
   npm uninstall @types/passport @types/passport-google-oauth20 @types/express-session @types/connect-pg-simple
   ```

**IMPORTANT**: Do NOT remove these until you've fully tested Clerk authentication in production.

## Rollback Plan

If you need to rollback to Passport:

1. Revert changes to:
   - `server/routes.ts` (use `setupGoogleAuth`)
   - `client/src/main.tsx` (remove `ClerkProvider`)
   - `client/src/hooks/useAuth.ts` (revert to query-only version)
   - `client/src/components/AuthGuard.tsx` (revert to Google OAuth button)

2. Restore environment variables:
   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   SESSION_SECRET=...
   ```

3. The database is unchanged, so all user data remains intact

## Troubleshooting

### "Missing VITE_CLERK_PUBLISHABLE_KEY" Error

- Make sure `VITE_CLERK_PUBLISHABLE_KEY` is set in environment variables
- On Replit, add it to Secrets
- On local dev, add it to `.env` file
- Restart the dev server after adding

### "User not found in database" After Sign In

- Check that webhook is configured correctly in Clerk dashboard
- Verify `CLERK_WEBHOOK_SECRET` is set correctly
- Check server logs for webhook errors
- Manually trigger webhook from Clerk dashboard to test

### "Access Denied" for Authorized Email

- Check that `AUTHORIZED_EMAIL` matches exactly (case-sensitive)
- Verify user's email in Clerk matches the authorized email
- Check database to see if `isAuthorized` is `true`:
  ```sql
  SELECT email, "isAuthorized" FROM users WHERE email = 'ernesto.chapa@gmail.com';
  ```

### Webhook Signature Verification Failed

- Verify `CLERK_WEBHOOK_SECRET` is correct
- Check that webhook endpoint URL is correct in Clerk dashboard
- Ensure webhook is sending to `https://` (not `http://`)

### Session Not Persisting

- Check browser console for errors
- Verify `CLERK_PUBLISHABLE_KEY` is correct
- Clear browser cookies and try again
- Check that Clerk application is in development mode for testing

## Testing Checklist

- [ ] Authorized user can sign in successfully
- [ ] User data syncs to database via webhook
- [ ] Dashboard loads after sign in
- [ ] API calls work with Clerk authentication
- [ ] Unauthorized users see "Access Denied"
- [ ] User can sign out using UserButton
- [ ] File uploads still work
- [ ] Receipt matching functionality preserved
- [ ] Statement management works
- [ ] All existing features function correctly

## Support

For Clerk-specific issues:
- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Discord](https://clerk.com/discord)

For application-specific issues:
- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Test webhook delivery in Clerk dashboard
