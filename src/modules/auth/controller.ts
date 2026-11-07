import { Request, Response, NextFunction } from 'express';
import AuthService from './service';
import { validateLoginDto } from './validators';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

class AuthController {
  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = validateLoginDto(req.body);
      const result = await AuthService.login(dto);
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  public getCurrentUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await AuthService.getCurrentUser(req.user!.id);
      res.status(200).json({ data: user });
    } catch (error) {
      next(error);
    }
  };

  public changeCredentials = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { newUsername, newPassword } = req.body || {};
      const result = await AuthService.changeCredentials(req.user!.id, newUsername, newPassword);
      res.status(200).json({ data: result, message: 'Credentials updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const result = await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
      res.status(200).json({ data: result, message: 'Password updated successfully' });
    } catch (error) {
      next(error);
    }
  };
}

export default new AuthController();
