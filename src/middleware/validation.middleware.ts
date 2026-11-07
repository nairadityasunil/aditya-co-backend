import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { createValidationError } from '../utils/app-error';

export const validateBody = (schema: Schema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      return next(createValidationError(message));
    }
    req.body = value;
    next();
  };
};
