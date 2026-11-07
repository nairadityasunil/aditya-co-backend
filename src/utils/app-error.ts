export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const createValidationError = (message: string) =>
  new AppError(400, message, 'VALIDATION_ERROR');

export const createNotFoundError = (resource: string) =>
  new AppError(404, `${resource} not found`, 'NOT_FOUND');

export const createUnauthorizedError = (message = 'Unauthorized') =>
  new AppError(401, message, 'UNAUTHORIZED');

export const createForbiddenError = (message = 'Forbidden') =>
  new AppError(403, message, 'FORBIDDEN');

export const createConflictError = (message: string) =>
  new AppError(409, message, 'CONFLICT');
