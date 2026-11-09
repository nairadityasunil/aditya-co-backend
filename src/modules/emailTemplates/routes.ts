import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { createNotFoundError, AppError } from '../../utils/app-error';
import { sendEmail } from '../mail/brevo';
import EmailTemplate from './model';
import { findDefault } from './defaults';
import { baseVars, ensureDefaultTemplates, getTemplate, renderTemplate, sampleVars } from './service';

// Email clients drop scripts; refusing them also keeps the CMS preview safe.
const html = Joi.string().max(200_000).custom((v, helpers) => (/<\s*script/i.test(v) ? helpers.error('any.invalid') : v), 'no scripts');

const updateSchema = Joi.object({
  name: Joi.string().trim().max(120),
  subject: Joi.string().trim().max(200),
  html: html.messages({ 'any.invalid': '"html" must not contain <script> tags' }),
  isActive: Joi.boolean(),
});
const draftSchema = Joi.object({ subject: Joi.string().trim().max(200), html });
const testSchema = draftSchema.keys({ to: Joi.string().trim().email().required() });

class EmailTemplateRoutes implements Routes {
  public path = '/api/admin/email-templates';
  public router = Router();

  constructor() {
    const guard = [requireAuth, requireAdmin];
    const wrap = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
      try {
        await fn(req, res);
      } catch (e) {
        next(e);
      }
    };

    this.router.get(this.path, ...guard, wrap(async (_req, res) => {
      await ensureDefaultTemplates();
      res.status(200).json({ data: await EmailTemplate.find().sort({ code: 1 }).lean() });
    }));

    this.router.get(`${this.path}/:code`, ...guard, wrap(async (req, res) => {
      const tpl = await getTemplate(req.params.code);
      if (!tpl) throw createNotFoundError('Email template');
      res.status(200).json({ data: tpl });
    }));

    this.router.patch(`${this.path}/:code`, ...guard, validateBody(updateSchema), wrap(async (req, res) => {
      const tpl = await EmailTemplate.findOneAndUpdate({ code: req.params.code.toUpperCase() }, { $set: req.body }, { new: true });
      if (!tpl) throw createNotFoundError('Email template');
      res.status(200).json({ data: tpl });
    }));

    this.router.post(`${this.path}/:code/reset`, ...guard, wrap(async (req, res) => {
      const def = findDefault(req.params.code.toUpperCase());
      if (!def) throw createNotFoundError('Email template');
      const tpl = await EmailTemplate.findOneAndUpdate({ code: def.code }, { $set: { ...def, isActive: true } }, { new: true, upsert: true });
      res.status(200).json({ data: tpl });
    }));

    // Renders the draft (or stored copy) with sample values, for the live preview.
    this.router.post(`${this.path}/:code/preview`, ...guard, validateBody(draftSchema), wrap(async (req, res) => {
      const tpl = await getTemplate(req.params.code);
      if (!tpl) throw createNotFoundError('Email template');
      const rendered = renderTemplate(
        { subject: req.body.subject ?? tpl.subject, html: req.body.html ?? tpl.html },
        { ...baseVars(), ...sampleVars(tpl.variables as never) }
      );
      res.status(200).json({ data: { subject: rendered.subject, html: rendered.html } });
    }));

    // Sends the draft with sample values to an address, to check real inbox rendering.
    this.router.post(`${this.path}/:code/test`, ...guard, validateBody(testSchema), wrap(async (req, res) => {
      const tpl = await getTemplate(req.params.code);
      if (!tpl) throw createNotFoundError('Email template');
      const rendered = renderTemplate(
        { subject: req.body.subject ?? tpl.subject, html: req.body.html ?? tpl.html },
        { ...baseVars(), ...sampleVars(tpl.variables as never) }
      );
      const result = await sendEmail({ to: req.body.to, ...rendered, subject: `[TEST] ${rendered.subject}` });
      if (!result.ok) throw new AppError(502, result.error ?? 'Could not send test email', 'MAIL_FAILED');
      res.status(200).json({ data: { message: `Test email sent to ${req.body.to}` } });
    }));
  }
}

export default EmailTemplateRoutes;
