import { LoginDto } from './dtos';
import { createValidationError } from '../../utils/app-error';

export const validateLoginDto = (body: unknown): LoginDto => {
  const data = body as Record<string, unknown>;
  const inputIdentifier = (data.email || data.username);

  if (!inputIdentifier || typeof inputIdentifier !== 'string' || !inputIdentifier.trim()) {
    throw createValidationError('Username or Email is required');
  }

  if (!data.password || typeof data.password !== 'string' || !data.password) {
    throw createValidationError('Password is required');
  }

  const email = (inputIdentifier as string).trim().toLowerCase();
  return { email, password: data.password };
};
