import { ClerkExpressRequireAuth, ClerkExpressWithAuth } from "@clerk/clerk-sdk-node";
import type { Express, RequestHandler, Request, Response } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";
import { Webhook } from 'svix';

// Single authorized email
const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL;

// Extend Express Request type to include Clerk auth
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string | null;
        sessionId?: string;
        claims?: any;
      };
    }
  }
}

export function setupClerkAuth(app: Express) {
  // Check required environment variables
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY environment variable is required");
  }
  if (!AUTHORIZED_EMAIL) {
    throw new Error("AUTHORIZED_EMAIL environment variable is required");
  }
  if (!process.env.CLERK_WEBHOOK_SECRET) {
    console.warn("⚠️  CLERK_WEBHOOK_SECRET not set - webhook signature verification will be disabled");
    console.warn("⚠️  This is OK for initial testing but should be configured for production");
  }

  console.log(`✅ Clerk auth configured with authorized email: ${AUTHORIZED_EMAIL}`);

  // Clerk webhook endpoint to sync users
  app.post('/api/webhooks/clerk', async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.warn("Webhook secret not configured - skipping signature verification");
      } else {
        // Verify webhook signature
        const svix_id = req.headers['svix-id'] as string;
        const svix_timestamp = req.headers['svix-timestamp'] as string;
        const svix_signature = req.headers['svix-signature'] as string;

        if (!svix_id || !svix_timestamp || !svix_signature) {
          return res.status(400).json({ error: 'Missing svix headers' });
        }

        const wh = new Webhook(webhookSecret);
        try {
          wh.verify(JSON.stringify(req.body), {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
          });
        } catch (err) {
          console.error('Webhook signature verification failed:', err);
          return res.status(400).json({ error: 'Invalid signature' });
        }
      }

      const { type, data } = req.body;

      // Handle user.created and user.updated events
      if (type === 'user.created' || type === 'user.updated') {
        const clerkUserId = data.id;
        const email = data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id)?.email_address;
        const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || email;
        const profilePicture = data.image_url;

        if (!email) {
          console.error('No email found in Clerk user data');
          return res.status(400).json({ error: 'No email found' });
        }

        // Check if this email is authorized
        const isAuthorized = email === AUTHORIZED_EMAIL;

        console.log(`Webhook received for ${email} - Authorized: ${isAuthorized}`);

        // Try to find existing user by Clerk ID or email
        let user = await storage.getUserByEmail(email);

        if (user) {
          // Update existing user with Clerk ID and authorization status
          user = await storage.updateUser(user.id, {
            googleId: clerkUserId, // Store Clerk ID in googleId field to maintain DB schema
            name,
            profilePicture,
            isAuthorized,
            lastLoginAt: new Date()
          });
          console.log(`Updated user ${email} (authorized: ${isAuthorized})`);
        } else {
          // Create new user
          user = await storage.createUser({
            email,
            name,
            googleId: clerkUserId, // Store Clerk ID in googleId field
            profilePicture,
            isAuthorized
          });
          console.log(`Created user ${email} (authorized: ${isAuthorized})`);
        }

        return res.json({ success: true, user });
      }

      // Handle user.deleted event
      if (type === 'user.deleted') {
        const clerkUserId = data.id;
        const user = await storage.getUserByGoogleId(clerkUserId);

        if (user) {
          // Mark as unauthorized instead of deleting to preserve data
          await storage.updateUser(user.id, { isAuthorized: false });
          console.log(`Marked user as unauthorized: ${user.email}`);
        }

        return res.json({ success: true });
      }

      // Acknowledge other webhook events
      return res.json({ success: true });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // Auth status endpoint (compatible with existing frontend)
  app.get('/api/auth/status', ClerkExpressWithAuth(), async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;

      if (!userId) {
        return res.json({
          authenticated: false,
          user: null
        });
      }

      // Get user from database by Clerk ID
      const user = await storage.getUserByGoogleId(userId);

      if (!user) {
        // User exists in Clerk but not in our database yet
        // This shouldn't happen if webhooks are working, but handle gracefully
        console.warn(`User ${userId} authenticated via Clerk but not found in database`);
        return res.json({
          authenticated: true,
          user: null
        });
      }

      return res.json({
        authenticated: true,
        user: user
      });
    } catch (error) {
      console.error('Auth status error:', error);
      return res.status(500).json({ error: 'Failed to get auth status' });
    }
  });
}

// Middleware to require authentication (compatible with existing code)
export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Get user from database
    const user = await storage.getUserByGoogleId(userId) as User | undefined;

    if (!user) {
      return res.status(401).json({
        error: 'User not found in database'
      });
    }

    // Check authorization
    if (!user.isAuthorized) {
      return res.status(403).json({
        error: 'User not authorized'
      });
    }

    // Attach user to request for backward compatibility
    (req as any).user = user;

    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Authentication failed'
    });
  }
};

// Export Clerk middleware for use in routes
export const clerkMiddleware = ClerkExpressWithAuth();
