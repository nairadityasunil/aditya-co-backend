import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { DEFAULT_GREETING, DEFAULT_LEAD_INTRO, DEFAULT_THANKS, DEFAULT_TOPICS } from './defaults';
import ChatbotConfig from './model';

/** The saved settings merged over the built-in defaults. */
async function getConfig() {
  const doc = await ChatbotConfig.findOne({ key: 'site' }).lean<Record<string, any>>();
  return {
    enabled: doc?.enabled ?? true,
    name: doc?.name || 'Aditya & Co. Assistant',
    greeting: doc?.greeting || DEFAULT_GREETING,
    topics: doc?.topics ?? DEFAULT_TOPICS,
    leadIntro: doc?.leadIntro || DEFAULT_LEAD_INTRO,
    thanks: doc?.thanks || DEFAULT_THANKS,
  };
}

/** A link target must stay on the site ("/services") or be a secure external address. */
const linkTarget = Joi.string().trim().allow('').max(300).pattern(/^(\/[\w\-./#?=&%]*|https:\/\/\S+)$/).messages({ 'string.pattern.base': 'Links must start with / (a page on this site) or https://' });

const topicSchema = Joi.object({
  id: Joi.string().trim().min(1).max(40).required(),
  label: Joi.string().trim().min(1).max(40).required(),
  type: Joi.string().valid('answer', 'lead', 'contact').required(),
  answer: Joi.string().trim().allow('').max(1000),
  linkLabel: Joi.string().trim().allow('').max(40),
  linkTo: linkTarget,
});

const adminSchema = Joi.object({
  enabled: Joi.boolean(),
  name: Joi.string().trim().min(1).max(60),
  greeting: Joi.string().trim().allow('').max(300),
  topics: Joi.array().items(topicSchema).max(8),
  leadIntro: Joi.string().trim().allow('').max(300),
  thanks: Joi.string().trim().allow('').max(300),
});

const defaults = { greeting: DEFAULT_GREETING, topics: DEFAULT_TOPICS, leadIntro: DEFAULT_LEAD_INTRO, thanks: DEFAULT_THANKS };

class ChatbotRoutes implements Routes {
  public path = '/api';
  public router = Router();

  constructor() {
    const guard = [requireAuth, requireAdmin];

    // Public: everything the widget needs to render its menu.
    this.router.get(`${this.path}/public/chatbot`, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ data: await getConfig() });
      } catch (e) {
        next(e);
      }
    });

    this.router.get(`${this.path}/admin/chatbot`, ...guard, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(200).json({ data: await getConfig(), defaults });
      } catch (e) {
        next(e);
      }
    });

    this.router.patch(`${this.path}/admin/chatbot`, ...guard, validateBody(adminSchema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        await ChatbotConfig.findOneAndUpdate({ key: 'site' }, { $set: req.body, $setOnInsert: { key: 'site' } }, { upsert: true, new: true });
        res.status(200).json({ data: await getConfig() });
      } catch (e) {
        next(e);
      }
    });
  }
}

export default ChatbotRoutes;
