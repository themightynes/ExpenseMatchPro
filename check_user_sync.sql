-- Check if user was synced from Clerk webhook
SELECT
  id,
  email,
  name,
  "googleId" as clerk_user_id,
  "isAuthorized" as is_authorized,
  "createdAt" as created_at,
  "lastLoginAt" as last_login_at
FROM users
WHERE email = 'ernesto.chapa@gmail.com';

-- If the above returns a row, the webhook worked!
-- The clerk_user_id should start with "user_"
-- is_authorized should be true
