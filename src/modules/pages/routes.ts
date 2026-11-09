import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { createNotFoundError, createValidationError } from '../../utils/app-error';
import PageContent from './model';

/** Pages/sections whose copy can be edited from the CMS (stored lowercase). */
export const PAGE_KEYS = ['navbar', 'home', 'shipping', 'servicedetail', 'software', 'about', 'achievements', 'contact', 'footer', 'cta'];

const bodySchema = Joi.object({ data: Joi.object().max(80).required() });

/** Values are limited to text (rich-text fields are stored as HTML), numbers, booleans and small nested lists. */
const MAX_STRING = 20000;
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) throw createValidationError('Content is nested too deeply');
  if (typeof value === 'string') {
    if (value.length > MAX_STRING) throw createValidationError('A text value is too long');
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (value.length > 40) throw createValidationError('A list has too many items');
    return value.map((v) => sanitize(v, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitize(v, depth + 1)]));
  }
  return '';
}

/** Keys are stored lowercase; the website looks them up by their camelCase name, so map them back. */
const CANONICAL: Record<string, string> = { servicedetail: 'serviceDetail' };

export const getAllPages = async (): Promise<Record<string, unknown>> => {
  const docs = await PageContent.find().lean();
  return Object.fromEntries(docs.map((d) => [CANONICAL[d.key] ?? d.key, d.data]));
};

class PageRoutes implements Routes {
  public path = '/api';
  public router = Router();

  constructor() {
    const guard = [requireAuth, requireAdmin];

    this.router.get(`${this.path}/public/pages`, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ data: await getAllPages() });
      } catch (e) {
        next(e);
      }
    });

    this.router.get(`${this.path}/admin/pages`, ...guard, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(200).json({ data: await getAllPages() });
      } catch (e) {
        next(e);
      }
    });

    this.router.patch(`${this.path}/admin/pages/:key`, ...guard, validateBody(bodySchema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = req.params.key.toLowerCase();
        if (!PAGE_KEYS.includes(key)) throw createNotFoundError('Page');
        const data = sanitize(req.body.data);
        const doc = await PageContent.findOneAndUpdate({ key }, { $set: { data } }, { new: true, upsert: true, runValidators: true });
        res.status(200).json({ data: doc.data });
      } catch (e) {
        next(e);
      }
    });

    // Reset a page back to the built-in defaults
    this.router.delete(`${this.path}/admin/pages/:key`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = req.params.key.toLowerCase();
        if (!PAGE_KEYS.includes(key)) throw createNotFoundError('Page');
        await PageContent.deleteOne({ key });
        res.status(200).json({ data: { message: 'Page reset to defaults' } });
      } catch (e) {
        next(e);
      }
    });
  }
}

export default PageRoutes;
