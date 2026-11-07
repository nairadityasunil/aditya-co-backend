import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import SiteSettings from './model';

const t = (max = 300) => Joi.string().trim().allow('').max(max);
const schema = Joi.object({
  companyName: t(120),
  tagline: t(200),
  phone: t(40),
  whatsapp: t(40),
  emails: Joi.array().items(Joi.string().trim().email()).max(5),
  address: t(400),
  mapEmbedUrl: t(1000),
  directionsUrl: t(500),
  linkedinUrl: t(300),
});

export const getSettings = async () => (await SiteSettings.findOne({ key: 'site' }).lean()) ?? (await SiteSettings.create({ key: 'site' })).toObject();

class SettingsRoutes implements Routes {
  public path = '/api';
  public router = Router();

  constructor() {
    this.router.get(`${this.path}/public/settings`, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ data: await getSettings() });
      } catch (e) {
        next(e);
      }
    });
    this.router.get(`${this.path}/admin/settings`, requireAuth, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(200).json({ data: await getSettings() });
      } catch (e) {
        next(e);
      }
    });
    this.router.patch(`${this.path}/admin/settings`, requireAuth, requireAdmin, validateBody(schema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await SiteSettings.findOneAndUpdate({ key: 'site' }, { $set: req.body }, { new: true, upsert: true, runValidators: true });
        res.status(200).json({ data: doc });
      } catch (e) {
        next(e);
      }
    });
  }
}

export default SettingsRoutes;
