import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Express Global Error Handling Middleware
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the unhandled error details with stack trace
  logger.error(`Unhandled error during request: ${req.method} ${req.url}`, {
    message: err.message,
    stack: err.stack,
  });

  // Handle JSON parsing syntax errors (common when sending malformed JSON bodies)
  if (err instanceof SyntaxError && 'status' in err && err.message.includes('JSON')) {
    return res.status(400).json({
      error: 'Malformed JSON payload. Please verify your request body syntax.',
    });
  }

  // General internal server error fallback
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
  });
}
