import config from '../../config/env';
import logger from '../../utils/logger';
import { escapeHtml, htmlToText } from '../../utils/escapeHtml';
import EmailTemplate from './model';
import { DEFAULT_TEMPLATES, findDefault, TemplateVariable } from './defaults';

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

const VAR_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Replaces {{var}} placeholders. Unknown variables become empty. HTML bodies are escaped. */
export const renderString = (template: string, vars: Record<string, string>, escape: boolean): string =>
  template.replace(VAR_RE, (_m, key: string) => {
    const value = vars[key] ?? '';
    return escape ? escapeHtml(value) : value;
  });

export const sampleVars = (variables: TemplateVariable[]): Record<string, string> =>
  Object.fromEntries(variables.map((v) => [v.key, v.sample ?? '']));

/** The company logo as a public https image (email clients cannot load files from the server). Override with MAIL_LOGO_URL. */
const LOGO_URL = process.env.MAIL_LOGO_URL?.trim() || 'https://res.cloudinary.com/drd6hssz1/image/upload/f_png,w_240/v1775758145/aditya_logo_i0lvpo.png';

export const baseVars = (): Record<string, string> => {
  const websiteUrl = (config.cors.frontendBaseUrl || '').replace(/\/$/, '');
  return { companyName: 'Aditya & Co.', websiteUrl, logoUrl: LOGO_URL, adminUrl: `${websiteUrl}/admin/enquiries` };
};

/** Inserts any default template missing from the database. Never overwrites an edited one. */
export const ensureDefaultTemplates = async (): Promise<void> => {
  for (const t of DEFAULT_TEMPLATES) {
    await EmailTemplate.updateOne({ code: t.code }, { $setOnInsert: t }, { upsert: true });
  }
};

export const getTemplate = async (code: string) => {
  const key = code.toUpperCase();
  const existing = await EmailTemplate.findOne({ code: key });
  if (existing) return existing;
  const def = findDefault(key);
  if (!def) return null;
  return EmailTemplate.findOneAndUpdate({ code: key }, { $setOnInsert: def }, { upsert: true, new: true });
};

export const renderTemplate = (tpl: { subject: string; html: string }, vars: Record<string, string>): RenderedMail => {
  const html = renderString(tpl.html, vars, true);
  return {
    // The subject is a mail header, not HTML: no escaping, and never a line break
    subject: renderString(tpl.subject, vars, false).replace(/[\r\n]+/g, ' ').trim().slice(0, 200),
    html,
    text: htmlToText(html),
  };
};

/** Fields of an enquiry as template variables. */
export const enquiryVars = (e: { name: string; email: string; phone?: string | null; service?: string | null; message: string; source?: string | null }, extra: Record<string, string> = {}): Record<string, string> => ({
  name: e.name,
  firstName: e.name.trim().split(/\s+/)[0] || 'there',
  email: e.email,
  phone: e.phone || 'Not provided',
  service: e.service || 'General enquiry',
  via: e.source === 'chatbot' ? 'chatbot' : 'contact form',
  message: e.message,
  ...extra,
});

/**
 * Renders a stored template. Returns null when an automatic email has been switched off in the CMS.
 * Manual sends (a reply, a test) pass ignoreActive so they always go out.
 */
export const renderMail = async (code: string, vars: Record<string, string>, opts: { ignoreActive?: boolean } = {}): Promise<RenderedMail | null> => {
  const tpl = await getTemplate(code);
  if (!tpl) throw new Error(`Email template ${code} not found`);
  if (!tpl.isActive && !opts.ignoreActive) {
    logger.info(`Email template ${code} is switched off in the CMS; not sending`);
    return null;
  }
  return renderTemplate(tpl, { ...baseVars(), ...vars });
};
