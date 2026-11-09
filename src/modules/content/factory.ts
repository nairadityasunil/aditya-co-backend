import { NextFunction, Request, Response, Router } from 'express';
import { Model } from 'mongoose';
import { ObjectSchema } from 'joi';
import { Routes } from '../../interfaces/routes.interface';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { createNotFoundError, createValidationError } from '../../utils/app-error';

export interface CrudOptions {
  /** URL segment, e.g. "projects" -> /api/admin/projects and /api/public/projects */
  path: string;
  /** Human readable name for error messages */
  label: string;
  model: Model<any>;
  schema: ObjectSchema;
  /** Optional explicit PATCH schema (defaults to the create schema with every key optional) */
  updateSchema?: ObjectSchema;
  searchFields: string[];
  /** Optional hook to derive fields (e.g. slug) before writing */
  prepare?: (data: Record<string, any>, isCreate: boolean) => Record<string, any>;
  /** Public listing filter (default: published only) */
  publicFilter?: Record<string, unknown>;
  /** Field the public list can be filtered by with ?<field>=value, and whose distinct values are returned in meta.facets */
  facetField?: string;
}

const reorderBody = (body: any): Array<{ id: string; displayOrder: number }> => {
  if (!body || !Array.isArray(body.orders)) throw createValidationError('orders array is required');
  return body.orders.map((o: any) => {
    if (!o || typeof o.id !== 'string' || typeof o.displayOrder !== 'number') {
      throw createValidationError('Each order needs an id and a numeric displayOrder');
    }
    return { id: o.id, displayOrder: o.displayOrder };
  });
};

/**
 * Builds a full CMS module (public list + admin CRUD + reorder) for one collection.
 * Same endpoint shape as the portfolio CMS: { data, meta } responses, /api/admin/* guarded by JWT.
 */
export function buildCrudRoutes(opts: CrudOptions): Routes {
  const { path, label, model, schema, searchFields, prepare, publicFilter = { isPublished: true }, facetField } = opts;
  const router = Router();
  const base = '/api';
  const updateSchema = opts.updateSchema ?? schema.fork(Object.keys(schema.describe().keys ?? {}), (s) => s.optional());
  const guard = [requireAuth, requireAdmin];

  router.get(`${base}/public/${path}`, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sort = { displayOrder: 1, createdAt: -1, _id: 1 } as const;
      res.set('Cache-Control', 'public, max-age=60');

      // Without page/limit the full list is returned (existing behaviour).
      if (req.query.page === undefined && req.query.limit === undefined) {
        res.status(200).json({ data: await model.find(publicFilter).sort(sort).lean() });
        return;
      }

      const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 50);
      const filter: Record<string, unknown> = { ...publicFilter };
      const facet = facetField && typeof req.query[facetField] === 'string' ? String(req.query[facetField]).trim() : '';
      if (facetField && facet && facet !== 'All') filter[facetField] = facet;

      const [data, total, facets] = await Promise.all([
        model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
        model.countDocuments(filter),
        facetField ? model.distinct(facetField, publicFilter) : Promise.resolve([]),
      ]);
      res.status(200).json({ data, meta: { total, page, limit, pages: Math.max(Math.ceil(total / limit), 1), facets: (facets as string[]).filter(Boolean).sort() } });
    } catch (e) {
      next(e);
    }
  });

  router.get(`${base}/admin/${path}`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const filter: Record<string, unknown> = {};
      if (search && searchFields.length) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.$or = searchFields.map((f) => ({ [f]: { $regex: escaped, $options: 'i' } }));
      }
      const [data, total] = await Promise.all([
        model.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        model.countDocuments(filter),
      ]);
      res.status(200).json({ data, meta: { total, page, limit } });
    } catch (e) {
      next(e);
    }
  });

  router.post(`${base}/admin/${path}/reorder`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orders = reorderBody(req.body);
      await model.bulkWrite(
        orders.map((o) => ({ updateOne: { filter: { _id: o.id }, update: { $set: { displayOrder: o.displayOrder } } } }))
      );
      res.status(200).json({ data: { message: `${label} reordered` } });
    } catch (e) {
      next(e);
    }
  });

  router.get(`${base}/admin/${path}/:id`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await model.findById(req.params.id).lean();
      if (!doc) throw createNotFoundError(label);
      res.status(200).json({ data: doc });
    } catch (e) {
      next(e);
    }
  });

  router.post(`${base}/admin/${path}`, ...guard, validateBody(schema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = prepare ? prepare(req.body, true) : req.body;
      if (data.displayOrder === undefined) data.displayOrder = await model.countDocuments();
      const doc = await model.create(data);
      res.status(201).json({ data: doc });
    } catch (e) {
      next(e);
    }
  });

  router.patch(`${base}/admin/${path}/:id`, ...guard, validateBody(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = prepare ? prepare(req.body, false) : req.body;
      const doc = await model.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
      if (!doc) throw createNotFoundError(label);
      res.status(200).json({ data: doc });
    } catch (e) {
      next(e);
    }
  });

  router.delete(`${base}/admin/${path}/:id`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const doc = await model.findByIdAndDelete(req.params.id);
      if (!doc) throw createNotFoundError(label);
      res.status(200).json({ data: { message: `${label} deleted` } });
    } catch (e) {
      next(e);
    }
  });

  return { path: `${base}/${path}`, router };
}
