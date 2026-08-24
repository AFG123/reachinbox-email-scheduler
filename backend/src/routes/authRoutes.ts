import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';

const router = Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/` }),
  (req: Request, res: Response) => {
    res.redirect(FRONTEND_URL);
  }
);

router.get('/me', (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated.' });
  }
});

router.get('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    
    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie('connect.sid');
      res.json({ message: 'Successfully logged out.' });
    });
  });
});

export default router;
