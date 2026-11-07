import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import { createUnauthorizedError, createForbiddenError } from '../utils/app-error';
import AdminUserRepository from '../modules/auth/repository';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role: string;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createUnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
      name?: string;
      role: string;
    };

    const user = await AdminUserRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      throw createUnauthorizedError('User no longer exists or is inactive');
    }

    req.user = { id: decoded.id, email: decoded.email, name: decoded.name || user.name, role: decoded.role };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(createUnauthorizedError());
    return;
  }
  if (req.user.role !== 'admin') {
    next(createForbiddenError('Admin access required'));
    return;
  }
  next();
};
