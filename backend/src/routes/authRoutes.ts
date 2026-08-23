import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';

const router = Router();

// 1. Redirect user to Google OAuth consent screen
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. Google OAuth callback handler
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: 'http://localhost:5173/' }),
  (req: Request, res: Response) => {
    // Authentication successful, redirect to frontend dashboard
    res.redirect('http://localhost:5173/');
  }
);

// 3. Retrieve currently authenticated user profile
router.get('/me', (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated.' });
  }
});

// 4. Logout route to clear session
router.get('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    
    // Clear the session cookie
    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie('connect.sid'); // default express-session cookie name
      res.json({ message: 'Successfully logged out.' });
    });
  });
});

export default router;
