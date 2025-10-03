# Setting Up Clerk Webhooks for Local Development

## The Problem

Clerk webhooks need to send HTTP requests to your application, but your app is running on `localhost:3000`, which is not accessible from the internet. You need a way to expose your local server to Clerk.

## Solutions

### Option 1: ngrok (Recommended for Local Dev) ⭐

**ngrok** creates a secure tunnel to your localhost and gives you a public URL.

#### Setup Steps:

1. **Install ngrok**:
   ```bash
   # Using npm
   npm install -g ngrok

   # Or download from https://ngrok.com/download
   ```

2. **Sign up for free account** (optional but recommended):
   - Go to https://ngrok.com/signup
   - Get your auth token
   - Run: `ngrok config add-authtoken YOUR_TOKEN`

3. **Start your app**:
   ```bash
   npm run dev
   # Your app is running on http://localhost:3000
   ```

4. **In a new terminal, start ngrok**:
   ```bash
   ngrok http 3000
   ```

5. **Copy the ngrok URL** (looks like `https://abc123.ngrok.io`)

6. **Configure Clerk webhook**:
   - Go to Clerk dashboard → Webhooks
   - Add endpoint: `https://abc123.ngrok.io/api/webhooks/clerk`
   - Subscribe to: `user.created`, `user.updated`, `user.deleted`
   - Copy the signing secret to your `.env`

#### Important Notes:
- ⚠️ ngrok URL changes every time you restart (unless you have a paid plan)
- ⚠️ You'll need to update the webhook URL in Clerk each time
- ✅ Free tier is perfect for development/testing

---

### Option 2: Cloudflare Tunnel (Free, Persistent URL)

**Cloudflare Tunnel** provides a stable URL that doesn't change.

#### Setup Steps:

1. **Install cloudflared**:
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared

   # Windows
   # Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

   # Linux
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. **Authenticate**:
   ```bash
   cloudflared tunnel login
   ```

3. **Create a tunnel**:
   ```bash
   cloudflared tunnel create expense-app
   ```

4. **Route the tunnel**:
   ```bash
   cloudflared tunnel route dns expense-app expense-app.yourdomain.com
   ```

5. **Start the tunnel**:
   ```bash
   cloudflared tunnel run --url localhost:3000 expense-app
   ```

6. **Configure webhook** with your persistent URL

---

### Option 3: VS Code Port Forwarding (If using VS Code)

If you're using VS Code with the Remote-SSH extension:

1. **Open Ports view**: View → Terminal → Ports
2. **Forward port 3000**
3. **Set visibility to Public**
4. **Copy the forwarded URL**
5. **Use this URL in Clerk webhook**

---

### Option 4: Replit Development Environment ⭐ (Easiest)

If you're using Replit, this is already solved!

1. **Replit automatically provides a public URL**
2. **Find your URL**: Look at the webview or check `.replit` config
3. **Use format**: `https://your-repl-name.your-username.repl.co/api/webhooks/clerk`
4. **Configure webhook** in Clerk dashboard

No additional tools needed!

---

### Option 5: Skip Webhook During Development (Quick Test)

You can manually create a user in the database for testing:

#### Steps:

1. **Sign in via Clerk** (authentication will work)

2. **Manually add user to database**:
   ```sql
   INSERT INTO users (email, name, "googleId", "isAuthorized", "createdAt", "updatedAt")
   VALUES (
     'ernesto.chapa@gmail.com',
     'Ernesto Chapa',
     'user_manual_test_id',
     true,
     NOW(),
     NOW()
   );
   ```

3. **Update the user's Clerk ID**:
   - Sign in to get the Clerk user ID from logs
   - Update database:
   ```sql
   UPDATE users
   SET "googleId" = 'user_[ACTUAL_CLERK_ID]'
   WHERE email = 'ernesto.chapa@gmail.com';
   ```

#### Cons:
- ❌ Manual process
- ❌ Won't sync automatically
- ❌ Need to repeat for each environment
- ✅ Good for quick testing only

---

## Recommended Approach

### For Local Development:
**Use ngrok** - Quick, easy, free

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3000

# Copy the https URL and configure in Clerk
```

### For Replit:
**Use Replit's URL** - Already exposed, no extra tools needed

### For Production:
**Use your actual domain** - Configure webhook with production URL

---

## Testing Your Webhook

After setting up:

1. **Check webhook is receiving events**:
   - In Clerk dashboard, go to Webhooks
   - Click on your endpoint
   - View "Recent Attempts" to see webhook deliveries

2. **Check your server logs**:
   ```bash
   # You should see:
   ✅ Clerk auth configured with authorized email: ernesto.chapa@gmail.com
   # When webhook fires:
   Webhook received for ernesto.chapa@gmail.com - Authorized: true
   Created user ernesto.chapa@gmail.com (authorized: true)
   ```

3. **Test sign-in**:
   - Sign in with authorized email
   - Check database for new user record
   - Verify `isAuthorized` is `true`

---

## Webhook URL Format

Make sure your webhook URL follows this format:

```
https://[your-public-url]/api/webhooks/clerk
```

Examples:
- ✅ `https://abc123.ngrok.io/api/webhooks/clerk`
- ✅ `https://expense-app.replit.app/api/webhooks/clerk`
- ✅ `https://api.yourdomain.com/api/webhooks/clerk`
- ❌ `http://localhost:3000/api/webhooks/clerk` (won't work - not public)

---

## Environment Variables

Don't forget to add the webhook secret after creating the endpoint:

```bash
# .env
CLERK_WEBHOOK_SECRET=whsec_...
```

Restart your server after adding!

---

## Troubleshooting

### Webhook not receiving events
- Check the URL is publicly accessible (test with `curl` or browser)
- Verify webhook is subscribed to correct events
- Check Clerk dashboard "Recent Attempts" for error details

### "Invalid signature" error
- Verify `CLERK_WEBHOOK_SECRET` is correct
- Make sure you copied the full secret (starts with `whsec_`)
- Restart server after adding secret

### "User not found in database"
- Check webhook fired successfully (Clerk dashboard)
- Check server logs for webhook processing errors
- Manually trigger webhook from Clerk dashboard to test

### ngrok URL keeps changing
- Sign up for free ngrok account for longer sessions
- Use a different tool (Cloudflare Tunnel) for stable URLs
- Or use a paid ngrok plan for reserved domains

---

## Quick Start with ngrok

```bash
# Install ngrok
npm install -g ngrok

# Start your app
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)

# Add webhook in Clerk:
# URL: https://abc123.ngrok.io/api/webhooks/clerk
# Events: user.created, user.updated, user.deleted

# Copy webhook secret to .env
echo "CLERK_WEBHOOK_SECRET=whsec_..." >> .env

# Restart your app
# npm run dev (restart to load new env var)

# Test sign-in!
```

That's it! 🎉
