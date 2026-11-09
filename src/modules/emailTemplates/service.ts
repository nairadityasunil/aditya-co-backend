import config from '../../config/env';
import logger from '../../utils/logger';
import { escapeHtml, htmlToText } from '../../utils/escapeHtml';
import { sendEmail, SendEmailResult } from '../mail/brevo';
import EmailTemplate from './model';
import { DEFAULT_TEMPLATES, findDefault, TemplateVariable } from './defaults';

const VAR_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Replaces {{var}} placeholders. Unknown variables become empty. HTML bodies are escaped. */
export const renderString = (template: string, vars: Record<string, string>, escape: boolean): string =>
  template.replace(VAR_RE, (_m, key: string) => {
    const value = vars[key] ?? '';
    return escape ? escapeHtml(value) : value;
  });

export const sampleVars = (variables: TemplateVariable[]): Record<string, string> =>
  Object.fromEntries(variables.map((v) => [v.key, v.sample ?? '']));

/** Inserts any default template missing from the database. Never overwrites an edited one. */
export const ensureDefaultTemplates = async (): Promise<void> => {
  for (const t of DEFAULT_TEMPLATES) {
    await EmailTemplate.updateOne({ code: t.code }, { $setOnInsert: t }, { upsert: true });
  }
};

export const getTemplate = async (code: string) => {
  const existing = await EmailTemplate.findOne({ code: code.toUpperCase() });
  if (existing) return existing;
  const def = findDefault(code.toUpperCase());
  if (!def) return null;
  return EmailTemplate.findOneAndUpdate({ code: def.code }, { $setOnInsert: def }, { upsert: true, new: true });
};

export const renderTemplate = (
  tpl: { subject: string; html: string },
  vars: Record<string, string>
): { subject: string; html: string; text: string } => {
  const html = renderString(tpl.html, vars, true);
  return {
    subject: renderString(tpl.subject, vars, false).replace(/[\r\n]+/g, ' ').trim(),
    html,
    text: htmlToText(html),
  };
};

/** Variables every template can use, merged under the caller's values. */
export const baseVars = (): Record<string, string> => ({
  companyName: 'Aditya & Co.',
  websiteUrl: config.email.websiteUrl,
  supportEmail: config.email.contactEmails[0] ?? '',
  phone: '+91 98252 95685',
});

/** Renders a stored template and sends it. Returns the outcome instead of throwing. */
export const sendTemplated = async (
  code: string,
  to: string | string[],
  vars: Record<string, string>,
  opts: { replyTo?: { email: string; name?: string } } = {}
): Promise<SendEmailResult> => {
  try {
    const tpl = await getTemplate(code);
    if (!tpl) return { ok: false, error: `Email template ${code} not found` };
    if (!tpl.isActive) return { ok: false, error: `Email template ${code} is switched off` };
    const rendered = renderTemplate(tpl, { ...baseVars(), ...vars });
    return await sendEmail({ to, ...rendered, replyTo: opts.replyTo });
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unexpected mail error';
    logger.error(`sendTemplated(${code}) failed: ${error}`);
    return { ok: false, error };
  }
};
