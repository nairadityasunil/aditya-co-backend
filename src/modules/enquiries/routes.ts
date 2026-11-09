import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { createNotFoundError } from '../../utils/app-error';
import config from '../../config/env';
import logger from '../../utils/logger';
import { sendTemplated } from '../emailTemplates/service';
import Enquiry from './model';

const formatIst = (d: Date) =>
  d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

/** Sends the company notification and the sender's thank-you, then records what happened. */
async function dispatchEnquiryEmails(enquiry: { _id: unknown; name: string; email: string; phone?: string | null; service?: string | null; message: string }) {
  try {
    const vars = {
      name: enquiry.name,
      email: enquiry.email,
      phone: enquiry.phone || 'Not provided',
      service: enquiry.service || 'General enquiry',
      message: enquiry.message,
      receivedAt: formatIst(new Date()),
    };
    const [notify, thanks] = await Promise.all([
      sendTemplated('ENQUIRY_NOTIFICATION', config.email.contactEmails, vars, { replyTo: { email: enquiry.email, name: enquiry.name } }),
      sendTemplated('ENQUIRY_THANK_YOU', enquiry.email, vars),
    ]);
    const errors = [notify.ok ? '' : `Notification: ${notify.error}`, thanks.ok ? '' : `Thank-you: ${thanks.error}`].filter(Boolean);
    await Enquiry.updateOne({ _id: enquiry._id }, { $set: { notified: notify.ok, acknowledged: thanks.ok, mailError: errors.join(' | ') } });
  } catch (err) {
    logger.error(`Enquiry email dispatch failed: ${err instanceof Error ? err.message : err}`);
  }
}

const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many enquiries, please try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
});

const submitSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().email().required(),
  phone: Joi.string().trim().allow('').max(30),
  service: Joi.string().trim().allow('').max(120),
  message: Joi.string().trim().min(5).max(3000).required(),
  // Honeypot: real users leave this empty
  website: Joi.string().allow(''),
});

class EnquiryRoutes implements Routes {
  public path = '/api';
  public router = Router();

  constructor() {
    const guard = [requireAuth, requireAdmin];

    this.router.post(`${this.path}/public/enquiries`, submitLimiter, (req: Request, res: Response, next: NextFunction) => {
      // Bots fill the hidden field: pretend it worked, store and send nothing
      if (typeof req.body?.website === 'string' && req.body.website.trim() !== '') {
        res.status(201).json({ data: { message: 'Enquiry received' } });
        return;
      }
      next();
    }, validateBody(submitSchema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { website: _hp, ...data } = req.body;
        const enquiry = await Enquiry.create(data);
        // The enquiry is saved; respond now and send the emails in the background
        void dispatchEnquiryEmails(enquiry);
        res.status(201).json({ data: { message: 'Enquiry received' } });
      } catch (e) {
        next(e);
      }
    });

    this.router.get(`${this.path}/admin/enquiries`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);
        const filter: Record<string, unknown> = {};
        if (typeof req.query.status === 'string' && ['new', 'read', 'replied'].includes(req.query.status)) filter.status = req.query.status;
        const [data, total, unread] = await Promise.all([
          Enquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
          Enquiry.countDocuments(filter),
          Enquiry.countDocuments({ status: 'new' }),
        ]);
        res.status(200).json({ data, meta: { total, page, limit, unread } });
      } catch (e) {
        next(e);
      }
    });

    this.router.patch(`${this.path}/admin/enquiries/:id`, ...guard, validateBody(Joi.object({ status: Joi.string().valid('new', 'read', 'replied').required() })), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await Enquiry.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
        if (!doc) throw createNotFoundError('Enquiry');
        res.status(200).json({ data: doc });
      } catch (e) {
        next(e);
      }
    });

    this.router.delete(`${this.path}/admin/enquiries/:id`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await Enquiry.findByIdAndDelete(req.params.id);
        if (!doc) throw createNotFoundError('Enquiry');
        res.status(200).json({ data: { message: 'Enquiry deleted' } });
      } catch (e) {
        next(e);
      }
    });
  }
}

export default EnquiryRoutes;
