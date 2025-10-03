# Clerk Setup Checklist ✅

## Status: Environment Variables Configured ✅

Your Clerk API keys have been added to `.env`:
- ✅ `CLERK_PUBLISHABLE_KEY`
- ✅ `CLERK_SECRET_KEY`
- ✅ `VITE_CLERK_PUBLISHABLE_KEY` (for frontend)
- ✅ `AUTHORIZED_EMAIL=ernesto.chapa@gmail.com`

## Next Steps

### 1. Configure Webhook in Clerk Dashboard (Required for User Sync)

1. Go to your Clerk dashboard: https://dashboard.clerk.com
2. Select your application: **special-raptor-47**
3. Navigate to: **Webhooks** (in left sidebar)
4. Click **Add Endpoint**
5. Configure:
   - **Endpoint URL**: `https://your-replit-url.replit.app/api/webhooks/clerk`
   - **Subscribe to events**:
     - ✅ `user.created`
     - ✅ `user.updated`
     - ✅ `user.deleted`
6. Click **Create**
7. Copy the **Signing Secret** (starts with `whsec_`)
8. Add to `.env`:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_...
   ```

**Note**: Webhook is optional for initial testing. The app will work, but user data won't sync to your database until webhook is configured.

### 2. Enable Google Authentication in Clerk

1. In Clerk dashboard, go to: **User & Authentication** → **Social Connections**
2. Find **Google** and click **Configure**
3. Toggle **Enable for sign-up and sign-in**
4. You can use Clerk's development keys or add your own Google OAuth credentials
5. Click **Save**

### 3. Test the Application

1. **Restart your dev server** (important - env vars need to reload):
   ```bash
   npm run dev
   ```

2. **Open the application** in your browser

3. **You should see**: Clerk's sign-in interface with Google as an option

4. **Sign in with**: `ernesto.chapa@gmail.com`

5. **Expected behavior**:
   - First time: Clerk webhook will create user in database
   - User will be marked as `isAuthorized: true` (because email matches)
   - You'll see the dashboard

6. **If you see "Access Denied"**:
   - Check that you signed in with exactly `ernesto.chapa@gmail.com`
   - Check server logs for webhook errors
   - Verify webhook is configured correctly in Clerk dashboard

### 4. Verify Database Sync (After First Sign-In)

Connect to your NeonDB and run:

```sql
SELECT id, email, name, "googleId", "isAuthorized", "createdAt", "lastLoginAt"
FROM users
WHERE email = 'ernesto.chapa@gmail.com';
```

You should see:
- `googleId`: Clerk user ID (starts with `user_`)
- `isAuthorized`: `true`
- `lastLoginAt`: Recent timestamp

### 5. Testing Other Users (Optional)

To test the authorization flow:

1. Sign in with a different email (not `ernesto.chapa@gmail.com`)
2. **Expected**: "Access Denied" screen
3. Check database - user should have `isAuthorized: false`

## Troubleshooting

### "Missing VITE_CLERK_PUBLISHABLE_KEY"
- ✅ Already configured in your `.env`
- Make sure to restart dev server after adding

### "User not found in database" after sign-in
- Configure the webhook (see Step 1 above)
- Manually trigger webhook from Clerk dashboard to test
- Check server logs for webhook errors

### Sign-in page not loading
- Clear browser cache and cookies
- Check browser console for errors
- Verify `VITE_CLERK_PUBLISHABLE_KEY` in `.env`

### "Invalid publishable key"
- Make sure key starts with `pk_test_` or `pk_live_`
- ✅ Your key looks correct: `pk_test_c3BlY2lhbC1yYXB0b3ItNDcuY2xlcmsuYWNjb3VudHMuZGV2JA`

## Replit-Specific Notes

If you're running on Replit:

1. **Get your Replit URL**:
   - Should be something like: `https://your-username-project-name.replit.app`
   - Or: `https://[random-id].replit.dev`

2. **Use this for webhook URL**:
   ```
   https://your-replit-url.replit.app/api/webhooks/clerk
   ```

3. **Important**: Replit URLs can change. If webhook stops working:
   - Check your current Replit URL
   - Update webhook endpoint in Clerk dashboard

## Environment Variables Summary

### Required (✅ Already Set)
```bash
CLERK_PUBLISHABLE_KEY=pk_test_c3BlY2lhbC1yYXB0b3ItNDcuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_RuGqNHfIoZZmJ2upt5JGgdxEDUWCAwO6eU4ekLNRCV
VITE_CLERK_PUBLISHABLE_KEY=pk_test_c3BlY2lhbC1yYXB0b3ItNDcuY2xlcmsuYWNjb3VudHMuZGV2JA
AUTHORIZED_EMAIL=ernesto.chapa@gmail.com
```

### Optional (For User Sync)
```bash
CLERK_WEBHOOK_SECRET=whsec_...  # Get from Clerk dashboard after creating webhook
```

## What Happens Without Webhook?

Without webhook configured:
- ✅ Sign-in will work
- ✅ Clerk will authenticate users
- ❌ User data won't sync to your database
- ❌ Authorization check will fail (no database record)
- ❌ Users will see "User not found in database" error

**Recommendation**: Configure webhook before testing.

## Quick Start (TL;DR)

1. Configure webhook in Clerk dashboard (see Step 1)
2. Add `CLERK_WEBHOOK_SECRET` to `.env`
3. Enable Google auth in Clerk dashboard
4. Restart dev server: `npm run dev`
5. Sign in with `ernesto.chapa@gmail.com`
6. ✅ Done!

## Support

- Clerk Docs: https://clerk.com/docs
- Clerk Discord: https://clerk.com/discord
- Check server logs for detailed error messages
