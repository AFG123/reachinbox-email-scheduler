import express, { Request, Response } from 'express';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import emailRoutes from './routes/emailRoutes';
import authRoutes from './routes/authRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './utils/logger';

dotenv.config();

import { validateEnv } from './config/env';
validateEnv();

// Load Passport strategy configuration
import './config/passport';

// Spin up the background BullMQ worker
import './workers/emailWorker';

const app = express();
const PORT = process.env.PORT || 5000;

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Enable CORS with credentials support so cookie sessions work
app.use(
  cors({
    origin: FRONTEND_URL, // Must match Vite frontend URL exactly
    credentials: true, // Allows sending cookies across origins
  })
);

// Parse incoming JSON payloads
app.use(express.json());

// Trust proxy behind Render's HTTPS load balancer/reverse proxy
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

// Configure Express Session
app.use(
  session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // Set to true in production (requires HTTPS)
      sameSite: isProduction ? 'none' : 'lax', // Allows cross-origin cookies in production
      httpOnly: true, // Protects against XSS attacks stealing session ID
      maxAge: 24 * 60 * 60 * 1000, // Cookie lasts 24 hours
    },
  })
);

// Initialize Passport Session middleware
app.use(passport.initialize());
app.use(passport.session());

// Ping route for health checks
app.get('/ping', (req: Request, res: Response) => {
  res.json({ message: 'pong' });
});

// Register OAuth login routes
app.use('/api/auth', authRoutes);

// Register scheduling routes
app.use('/api/emails', emailRoutes);

// Register the global error handler middleware (must be registered last!)
app.use(errorHandler);

// Import stale processing recovery
import { recoverStaleEmails } from './workers/recovery';

app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
  
  // Run stale processing recovery loop on startup and every 2 minutes
  recoverStaleEmails();
  setInterval(recoverStaleEmails, 2 * 60 * 1000);
});
