# Deploy Clerk Migration to Replit

## Current Status
- ✅ Clerk authentication working on localhost
- ✅ Local file storage working for development
- ⚠️ 119 files exist in Replit object storage (not accessible from localhost)

## Steps to Deploy to Replit

### 1. Push Code to Replit

```bash
git add .
git commit -m "Migrate from Passport to Clerk authentication"
git push
```

Or if using Replit directly:
- Upload files via Replit interface
- Or use Replit's Git integration

### 2. Configure Replit Secrets

In Replit, go to **Tools → Secrets** and add:

```
CLERK_PUBLISHABLE_KEY=pk_test_c3BlY2lhbC1yYXB0b3ItNDcuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_RuGqNHfIoZZmJ2upt5JGgdxEDUWCAwO6eU4ekLNRCV
CLERK_WEBHOOK_SECRET=whsec_[YOUR_WEBHOOK_SECRET]
VITE_CLERK_PUBLISHABLE_KEY=pk_test_c3BlY2lhbC1yYXB0b3ItNDcuY2xlcmsuYWNjb3VudHMuZGV2JA
AUTHORIZED_EMAIL=ernesto.chapa@gmail.com
```

Keep existing secrets:
- `DATABASE_URL`
- `DEFAULT_OBJECT_STORAGE`
- All other existing variables

**Remove** (no longer needed):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`

### 3. Update Clerk Webhook URL

1. Go to Clerk dashboard: https://dashboard.clerk.com
2. Navigate to **Webhooks**
3. Find your existing webhook (or create new one)
4. Update URL to your Replit URL:
   ```
   https://[your-repl-name].[your-username].repl.co/api/webhooks/clerk
   ```
   Or if using deployment URL:
   ```
   https://[your-deployment-url].replit.app/api/webhooks/clerk
   ```
5. Ensure subscribed to: `user.created`, `user.updated`, `user.deleted`

### 4. Deploy and Test

1. **Run on Replit**: The app should start automatically or run `npm run dev`

2. **Check logs** for:
   ```
   ☁️  Using Replit object storage
   ✅ Clerk auth configured with authorized email: ernesto.chapa@gmail.com
   ```

3. **Open your Replit app URL**

4. **Sign in** with `ernesto.chapa@gmail.com`

5. **Verify**:
   - ✅ Authentication works
   - ✅ Dashboard loads
   - ✅ Images/PDFs display (all 119 files should work!)
   - ✅ All existing data is intact

### 5. Database Verification

Your existing user might already be in the database from the old Passport setup. Check:

```sql
SELECT email, "googleId", "isAuthorized", "lastLoginAt"
FROM users
WHERE email = 'ernesto.chapa@gmail.com';
```

**If user exists but has old Google OAuth ID:**
- The webhook will update `googleId` with new Clerk user ID on first login
- `isAuthorized` will be set to `true`

**If user doesn't exist:**
- Webhook will create new user on first login

## Expected Behavior on Replit

### File Storage
- ✅ Uses Replit object storage (all 119 files accessible)
- ✅ New uploads go to Replit storage
- ✅ No local storage used

### Authentication
- ✅ Clerk handles authentication
- ✅ Webhook syncs to PostgreSQL
- ✅ Single email authorization enforced
- ✅ All existing business logic preserved

## Troubleshooting on Replit

### Images still not showing
- Check Replit logs for object storage errors
- Verify `DEFAULT_OBJECT_STORAGE` secret is set
- Check that Replit's credential service is running (port 1106)

### Webhook not firing
- Verify webhook URL matches your Replit URL exactly
- Check webhook recent attempts in Clerk dashboard
- Manually trigger webhook from Clerk to test

### "User not found in database"
- Check that webhook secret is correct
- Look for webhook processing errors in logs
- Manually trigger webhook from Clerk dashboard

## Dual Environment Setup

You now have:

### Localhost Development
- ✅ Local file storage (`.local-storage/` directory)
- ✅ Works with ngrok webhook for testing
- ⚠️ Won't have access to Replit's 119 files

### Replit Production
- ✅ Replit object storage (119 existing files + new uploads)
- ✅ Direct webhook (no ngrok needed)
- ✅ All existing data accessible

## Migration Complete Checklist

- [ ] Code deployed to Replit
- [ ] Clerk secrets added to Replit
- [ ] Webhook URL updated in Clerk dashboard
- [ ] App running on Replit
- [ ] Successful login test
- [ ] Images/PDFs displaying
- [ ] Database user synced
- [ ] All features working

## Rolling Back (If Needed)

If something goes wrong on Replit:

1. Keep the code as-is (backward compatible)
2. Add back old secrets:
   ```
   GOOGLE_CLIENT_ID
   GOOGLE_CLIENT_SECRET
   SESSION_SECRET
   ```
3. In `server/routes.ts`, change line 5:
   ```typescript
   // Change from:
   import { setupClerkAuth, requireAuth, clerkMiddleware } from "./clerkAuth";
   // Back to:
   import { setupGoogleAuth, requireAuth } from "./googleAuth";
   ```
4. In `server/routes.ts`, change line 135:
   ```typescript
   // Change from:
   setupClerkAuth(app);
   // Back to:
   setupGoogleAuth(app);
   ```
5. Comment out line 141 (Clerk middleware)

The database is unchanged, so rollback is safe.

## Next Steps

Once deployed to Replit:
1. Test thoroughly with existing data
2. Verify all 119 files are accessible
3. Test file uploads/downloads
4. Once confident, remove old auth code:
   - Delete `server/googleAuth.ts`
   - Remove Passport dependencies
   - Clean up old secrets
