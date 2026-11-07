import { Router } from 'express';
import { Routes } from '../../interfaces/routes.interface';
import AuthController from './controller';
import { requireAuth } from '../../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

class AuthRoutes implements Routes {
  public path = '/api/auth';
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(`${this.path}/login`, loginLimiter, AuthController.login);
    this.router.get(`${this.path}/me`, requireAuth, AuthController.getCurrentUser);
    this.router.post(`${this.path}/change-credentials`, requireAuth, AuthController.changeCredentials);
    this.router.post(`${this.path}/change-password`, requireAuth, AuthController.changePassword);
  }
}

export default AuthRoutes;
