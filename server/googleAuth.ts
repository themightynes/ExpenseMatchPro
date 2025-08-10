import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

// Single authorized email - you should set this in environment variables
const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL;

export function setupGoogleAuth(app: Express) {
  // Check required environment variables
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is required");
  }
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_SECRET environment variable is required");
  }
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  if (!AUTHORIZED_EMAIL) {
    throw new Error("AUTHORIZED_EMAIL environment variable is required");
  }

  // Session configuration with persistent storage
  const isProduction = process.env.NODE_ENV === 'production';
  const PgSession = ConnectPgSimple(session);
  
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session', // Use a specific table for sessions
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on each request
    cookie: {
      secure: isProduction, // Use secure cookies in production
      httpOnly: true,
      maxAge: 6 * 60 * 60 * 1000, // 6 hours (longer for upload workflows)
      sameSite: isProduction ? 'strict' : 'lax'
    },
    name: 'expense.session' // Custom session name
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth Strategy with dynamic callback URL
  const callbackURL = process.env.NODE_ENV === 'production' 
    ? "https://ernestochapa-expense.replit.app/auth/google/callback"
    : `https://${process.env.REPLIT_DEV_DOMAIN}/auth/google/callback`;
    
  console.log(`OAuth callback URL configured: ${callbackURL}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Dev domain: ${process.env.REPLIT_DEV_DOMAIN}`);
    
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: callbackURL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;
      const googleId = profile.id;
      const profilePicture = profile.photos?.[0]?.value;

      if (!email) {
        return done(new Error("No email found in Google profile"));
      }

      // Check if this email is authorized
      const isAuthorized = email === AUTHORIZED_EMAIL;

      if (!isAuthorized) {
        return done(new Error("Unauthorized email address"));
      }

      // Try to find existing user
      let user = await storage.getUserByGoogleId(googleId);
      
      if (!user) {
        // Check if user exists by email
        user = await storage.getUserByEmail(email);
        
        if (user) {
          // Update existing user with Google ID
          user = await storage.updateUser(user.id, {
            googleId,
            name,
            profilePicture,
            isAuthorized: true,
            lastLoginAt: new Date()
          });
        } else {
          // Create new user
          user = await storage.createUser({
            email,
            name,
            googleId,
            profilePicture,
            isAuthorized: true
          });
        }
      } else {
        // Update last login
        user = await storage.updateUser(user.id, {
          lastLoginAt: new Date(),
          name,
          profilePicture
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }));

  // Serialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Debug route to check OAuth configuration
  app.get('/auth/debug', (req, res) => {
    res.json({
      callbackURL,
      environment: process.env.NODE_ENV,
      devDomain: process.env.REPLIT_DEV_DOMAIN,
      timestamp: new Date().toISOString()
    });
  });

  // Auth routes
  app.get('/auth/google', (req, res, next) => {
    console.log('Starting Google OAuth flow...');
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
  });

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      // Successful authentication, redirect to dashboard
      // Use script to ensure redirect happens in parent window if in popup
      res.send(`
        <script>
          if (window.opener) {
            window.opener.location.href = '/';
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
      `);
    }
  );

  app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.redirect('/login');
    });
  });

  app.get('/api/auth/status', (req, res) => {
    if (req.isAuthenticated() && req.user) {
      res.json({ 
        authenticated: true, 
        user: req.user 
      });
    } else {
      res.json({ 
        authenticated: false, 
        user: null 
      });
    }
  });
}

// Middleware to require authentication
export const requireAuth: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && req.user) {
    const user = req.user as User;
    if (user.isAuthorized) {
      return next();
    }
  }
  
  return res.status(401).json({ 
    error: 'Authentication required',
    redirectUrl: '/auth/google'
  });
};