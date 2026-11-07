import jwt from 'jsonwebtoken';
import { LoginDto } from './dtos';
import AdminUserRepository from './repository';
import config from '../../config/env';
import { createUnauthorizedError, createValidationError } from '../../utils/app-error';

class AuthService {
  public async login(dto: LoginDto): Promise<{ token: string; user: { id: string; email: string; name: string; role: string; mustChangePassword: boolean } }> {
    const user = await AdminUserRepository.findByEmail(dto.email);

    if (!user || !user.isActive) {
      throw createUnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await user.comparePassword(dto.password);
    if (!isPasswordValid) {
      throw createUnauthorizedError('Invalid credentials');
    }

    await AdminUserRepository.updateLastLogin(String(user._id));

    const token = jwt.sign(
      { id: String(user._id), email: user.email, name: user.name, role: user.role },
      config.jwt.secret,
      { expiresIn: String(config.jwt.expiresIn) as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}` | number }
    );

    return {
      token,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }

  public async getCurrentUser(id: string) {
    const user = await AdminUserRepository.findById(id);
    if (!user) throw createUnauthorizedError();
    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword ?? false,
    };
  }

  public async changeCredentials(userId: string, newUsername: string, newPassword: string) {
    const user = await AdminUserRepository.findByIdWithPassword(userId);
    if (!user) throw createUnauthorizedError('User not found');

    const cleanUsername = (newUsername || '').trim().toLowerCase();
    const cleanPassword = (newPassword || '').trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      throw createValidationError('New username must be at least 3 characters');
    }

    if (!cleanPassword || cleanPassword.length < 4) {
      throw createValidationError('New password must be at least 4 characters');
    }

    if (cleanUsername === 'admin' && cleanPassword === 'admin') {
      throw createValidationError('You cannot keep the default admin/admin credentials. Please choose custom credentials.');
    }

    user.email = cleanUsername;
    user.password = cleanPassword;
    user.mustChangePassword = false;
    await user.save();

    const token = jwt.sign(
      { id: String(user._id), email: user.email, name: user.name, role: user.role },
      config.jwt.secret,
      { expiresIn: String(config.jwt.expiresIn) as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}` | number }
    );

    return {
      token,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: false,
      },
    };
  }

  public async changePassword(userId: string, currentPassword?: string, newPassword?: string) {
    const user = await AdminUserRepository.findByIdWithPassword(userId);
    if (!user) throw createUnauthorizedError('User not found');

    const cleanCurrent = (currentPassword || '').trim();
    const cleanNew = (newPassword || '').trim();

    if (!cleanCurrent) {
      throw createValidationError('Current password is required');
    }

    const isCurrentValid = await user.comparePassword(cleanCurrent);
    if (!isCurrentValid) {
      throw createUnauthorizedError('Current password is incorrect');
    }

    if (!cleanNew || cleanNew.length < 4) {
      throw createValidationError('New password must be at least 4 characters long');
    }

    if (cleanCurrent === cleanNew) {
      throw createValidationError('New password must be different from current password');
    }

    user.password = cleanNew;
    await user.save();

    const token = jwt.sign(
      { id: String(user._id), email: user.email, name: user.name, role: user.role },
      config.jwt.secret,
      { expiresIn: String(config.jwt.expiresIn) as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}` | number }
    );

    return {
      token,
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }
}

export default new AuthService();
