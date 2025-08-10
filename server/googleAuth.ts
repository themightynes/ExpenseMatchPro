import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

// Single authorized email - you should set this in environment variables
const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL || "your-email@gmail.com";

export function setupGoogleAuth(app: Express) {
  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-session-secret-change-this',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/auth/google/callback"
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

  // Auth routes
  app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
      // Successful authentication, redirect to dashboard
      res.redirect('/');
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