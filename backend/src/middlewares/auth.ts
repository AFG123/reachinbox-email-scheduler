import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to protect API routes, verifying if the user has a valid Google session cookie.
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please login first.' });
}
