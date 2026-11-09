import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { AppError, createNotFoundError } from '../../utils/app-error';
import config from '../../config/env';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { companyNotification, replyToVisitor, testEmail, visitorConfirmation } from '../../services/mail.templates';
import { logMailFailure, mailConfigured, mailStatus, sendMail } from '../../services/mailer.service';
import { enquiryVars, renderMail, RenderedMail } from '../emailTemplates/service';
import SiteSettings from '../settings/model';
import Enquiry from './model';

/** Who gets the "new enquiry" email: MAIL_TO if set, otherwise the emails saved under Contact details in the CMS. */
async function recipients(): Promise<string[]> {
  if (config.mail.to.length) return config.mail.to;
  const settings = await SiteSettings.findOne({ key: 'site' }).lean<{ emails?: string[] }>();
  return settings?.emails ?? [];
}

/**
 * Builds a mail from its CMS-editable template. Returns null when the template is switched off.
 * If the database is unreachable the built-in wording is used, so an enquiry email is never lost to that.
 */
async function build(code: string, vars: Record<string, string>, fallback: () => RenderedMail, opts: { ignoreActive?: boolean } = {}): Promise<RenderedMail | null> {
  try {
    return await renderMail(code, vars, opts);
  } catch (e) {
    logMailFailure(`template ${code}`, e);
    return fallback();
  }
}

/** Emails the company and the visitor, then records the outcome on the enquiry. Runs in the background. */
async function emailEnquiry(id: string, data: Record<string, any>): Promise<void> {
  let status: 'sent' | 'failed' | 'skipped';
  let visitor: 'sent' | 'failed' | 'skipped' = 'skipped';
  let error = '';
  try {
    const to = await recipients();
    logger.info(`[enquiry] ${id}: emailing the team at ${to.join(', ') || '(no recipient)'} and the visitor at ${data.email}`);
    if (!to.length) throw new Error('No recipient: set MAIL_TO or add an email under Contact details.');
    const mail = await build('ENQUIRY_NOTIFICATION', enquiryVars(data as any), () => companyNotification(data as any));
    if (mail) {
      await sendMail({ to, subject: mail.subject, html: mail.html, text: mail.text, replyTo: data.email });
      status = 'sent';
    } else {
      status = 'skipped';
      logger.warn(`[enquiry] ${id}: team notification skipped because the ENQUIRY_NOTIFICATION template is switched off in the CMS`);
    }
  } catch (e) {
    status = 'failed';
    error = (e as Error).message.slice(0, 300);
    logMailFailure('enquiry notification', e);
  }
  // The visitor's confirmation is a courtesy: its failure never marks the enquiry as failed.
  try {
    const mail = await build('ENQUIRY_THANK_YOU', enquiryVars(data as any), () => visitorConfirmation(data as any));
    if (mail) {
      await sendMail({ to: data.email, subject: mail.subject, html: mail.html, text: mail.text });
      visitor = 'sent';
    } else {
      logger.warn(`[enquiry] ${id}: visitor thank-you skipped because the ENQUIRY_THANK_YOU template is switched off in the CMS`);
    }
  } catch (e) {
    visitor = 'failed';
    logMailFailure('visitor confirmation', e);
  }
  logger.info(`[enquiry] ${id}: email result: team=${status}${error ? ` (${error})` : ''}, visitor=${visitor}`);
  await Enquiry.updateOne({ _id: id }, { $set: { emailStatus: status, emailError: error } }).catch(() => undefined);
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
  source: Joi.string().valid('contact-form', 'chatbot').default('contact-form'),
  // Honeypot: real users leave this empty
  website: Joi.string().allow('').max(0),
});

class EnquiryRoutes implements Routes {
  public path = '/api';
  public router = Router();

  constructor() {
    const guard = [requireAuth, requireAdmin];

    this.router.post(`${this.path}/public/enquiries`, submitLimiter, validateBody(submitSchema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { website: _hp, ...data } = req.body;
        const doc = await Enquiry.create(data);
        // Saved first, so an enquiry is never lost; the emails go out in the background.
        const emailQueued = mailConfigured();
        logger.info(`[enquiry] saved ${String(doc._id)} from ${doc.email} (${(doc as any).source || 'contact form'}); emails ${emailQueued ? 'queued' : 'NOT queued: mail is not configured on the server'}`);
        if (emailQueued) void emailEnquiry(String(doc._id), doc.toObject());
        res.status(201).json({ data: { message: 'Enquiry received', emailQueued } });
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

    // Is email set up, and does it work? (shown on the CMS Enquiries page)
    this.router.get(`${this.path}/admin/mail/status`, ...guard, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.status(200).json({ data: { ...mailStatus(), recipients: await recipients() } });
      } catch (e) {
        next(e);
      }
    });

    this.router.post(`${this.path}/admin/mail/test`, ...guard, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const to = await recipients();
        if (!to.length) throw new AppError(400, 'No recipient: set MAIL_TO or add an email under Contact details.', 'MAIL_NO_RECIPIENT');
        logger.info(`[mail] test email requested for ${to.join(', ')}`);
        const mail = (await build('TEST_EMAIL', {}, testEmail, { ignoreActive: true }))!;
        try {
          await sendMail({ to, subject: mail.subject, html: mail.html, text: mail.text });
        } catch (e) {
          throw new AppError(502, `The test email could not be sent: ${(e as Error).message}`, 'MAIL_FAILED');
        }
        res.status(200).json({ data: { sent: true, to } });
      } catch (e) {
        next(e);
      }
    });

    // Reply to the visitor by email from the CMS. The reply is recorded only once the email has actually gone out.
    this.router.post(`${this.path}/admin/enquiries/:id/reply`, ...guard, validateBody(Joi.object({ message: Joi.string().trim().min(2).max(5000).required() })), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const doc = await Enquiry.findById(req.params.id);
        if (!doc) throw createNotFoundError('Enquiry');
        if (!mailConfigured()) throw new AppError(400, 'Email is not set up on the server, so replies cannot be sent yet. See the email notice at the top of this page.', 'MAIL_NOT_CONFIGURED');

        const user = (req as AuthenticatedRequest).user;
        logger.info(`[reply] ${String(doc._id)}: ${(user as any)?.email ?? 'a CMS user'} is replying to ${doc.email}`);
        const sentBy = user?.name || user?.email || '';
        const mail = (await build('ENQUIRY_REPLY', enquiryVars(doc.toObject() as any, { reply: req.body.message, sentBy: sentBy || 'Aditya & Co.' }), () => replyToVisitor(doc.toObject() as any, req.body.message, sentBy), { ignoreActive: true }))!;
        try {
          // The visitor's answer goes to the firm's own inbox.
          await sendMail({ to: doc.email, subject: mail.subject, html: mail.html, text: mail.text, replyTo: (await recipients())[0] });
        } catch (e) {
          throw new AppError(502, `The reply could not be sent: ${(e as Error).message}`, 'MAIL_FAILED');
        }
        doc.replies.push({ message: req.body.message, subject: mail.subject, sentBy, sentAt: new Date() } as any);
        doc.status = 'replied';
        await doc.save();
        res.status(200).json({ data: doc });
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
