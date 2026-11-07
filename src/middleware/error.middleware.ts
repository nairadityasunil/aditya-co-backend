import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import logger from '../utils/logger';
import config from '../config/env';

const errorMiddleware = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error(`Unexpected error: ${err.message}`, { stack: err.stack });
    } else {
      logger.warn(`Operational error: ${err.message}`);
    }

    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Mongoose duplicate key error
  if ((err as unknown as { code: number }).code === 11000) {
    const field = Object.keys((err as unknown as { keyValue: Record<string, unknown> }).keyValue || {})[0] || 'field';
    res.status(409).json({
      error: `A record with that ${field} already exists`,
      code: 'DUPLICATE_KEY',
    });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values((err as unknown as { errors: Record<string, { message: string }> }).errors)
      .map((e) => e.message)
      .join(', ');
    res.status(400).json({ error: messages, code: 'VALIDATION_ERROR' });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    return;
  }

  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

  res.status(500).json({
    error: config.isProduction ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
};

export default errorMiddleware;
