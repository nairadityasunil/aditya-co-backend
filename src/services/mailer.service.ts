import nodemailer, { Transporter } from 'nodemailer';
import config from '../config/env';
import logger from '../utils/logger';
import { logBrevoDiagnosis, trackDelivery } from './brevo.diagnostics';

/**
 * Email for enquiries, built on Nodemailer.
 *
 * Plain Nodemailer over SMTP: set SMTP_HOST (or SMTP_SERVICE=gmail), SMTP_USER and SMTP_PASS. No third-party sending
 * service is needed, any mailbox with SMTP access will do.
 *
 * One catch: Render's FREE web services block outbound SMTP on ports 25, 465 and 587, so those logins time out there.
 * Works fine locally, on a paid Render plan, or with a mail server that listens on another port (many offer 2525).
 * BREVO_API_KEY is an optional extra for the free plan only: the same Nodemailer API, delivered over HTTPS instead.
 */

export interface MailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type MailMode = 'brevo-api' | 'smtp' | 'none';

const RENDER_BLOCKED_PORTS = [25, 465, 587];
const HTTP_TIMEOUT_MS = 15_000;

export function mailMode(): MailMode {
  if (config.mail.brevoApiKey) return 'brevo-api';
  if (config.mail.smtp.host || config.mail.smtp.service) return 'smtp';
  return 'none';
}

/** Things that stop mail from working, in plain words (shown in the CMS). */
/** The SMTP port actually in use (a service such as gmail brings its own). */
const smtpPort = (): number => (config.mail.smtp.host ? config.mail.smtp.port : config.mail.smtp.service ? 465 : config.mail.smtp.port);

export function mailProblems(): string[] {
  const problems: string[] = [];
  const mode = mailMode();
  if (mode === 'none') problems.push('No mail server is set. Add SMTP_HOST (or SMTP_SERVICE=gmail), SMTP_USER and SMTP_PASS to the backend environment.');
  if (mode === 'smtp' && config.mail.smtp.user && !config.mail.smtp.pass) problems.push('SMTP_PASS is not set. For Gmail use an App Password (Google Account > Security > 2-Step Verification > App passwords).');
  if (mode !== 'none' && !senderAddress()) problems.push('MAIL_FROM (or EMAIL_FROM) is not set. Use an address your provider has verified, for example "Aditya & Co. <no-reply@yourdomain.com>".');
  if (mode === 'smtp' && process.env.RENDER && RENDER_BLOCKED_PORTS.includes(smtpPort())) {
    problems.push(`SMTP port ${smtpPort()} is blocked on Render's free plan. Upgrade the Render plan, use a mail server that listens on another port (for example 2525), or set BREVO_API_KEY to send over HTTPS instead.`);
  }
  return problems;
}

export const mailConfigured = (): boolean => mailMode() !== 'none' && !!senderAddress();

export function mailStatus() {
  const mode = mailMode();
  return {
    configured: mailConfigured(),
    mode,
    host: mode === 'smtp' ? config.mail.smtp.host || `${config.mail.smtp.service} (SMTP)` : mode === 'brevo-api' ? 'api.brevo.com (HTTPS)' : '',
    port: mode === 'smtp' ? smtpPort() : mode === 'brevo-api' ? 443 : null,
    from: config.mail.from || config.mail.smtp.user || '',
    to: config.mail.to,
    problems: mailProblems(),
    lastSend,
  };
}

/* ---------------------------------------------------------------- address helpers */

interface Addr {
  name?: string;
  email: string;
}

/** Accepts "a@b.com", "Name <a@b.com>", {name, address} or a list of those. */
function parseAddrs(value: unknown): Addr[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseAddrs);
  if (typeof value === 'object') {
    const v = value as { name?: string; address?: string };
    return v.address ? [{ name: v.name || undefined, email: v.address }] : [];
  }
  return String(value)
    .split(',')
    .map((part) => {
      const m = part.trim().match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
      return m ? { name: m[1]?.trim() || undefined, email: m[2].trim() } : { email: part.trim() };
    })
    .filter((a) => a.email);
}

function senderAddress(): Addr | null {
  return parseAddrs(config.mail.from || config.mail.smtp.user)[0] ?? null;
}

/* ---------------------------------------------------------------- transports */

/** What happened on the last send, shown in the CMS and logged, so "no email arrived" can be diagnosed. */
export interface LastSend {
  at: string;
  ok: boolean;
  to: string;
  messageId?: string;
  error?: string;
}
let lastSend: LastSend | null = null;
const record = (r: Omit<LastSend, 'at'>) => {
  lastSend = { at: new Date().toISOString(), ...r };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Sends through Brevo's HTTP API directly (the same call the Sorin backend makes), with retries on
 * network errors, 429 and 5xx. Throws a readable error when Brevo refuses the message.
 */
async function sendViaBrevo(opts: MailOptions): Promise<string | undefined> {
  const sender = senderAddress()!;
  const to = parseAddrs(opts.to);
  const replyTo = parseAddrs(opts.replyTo)[0];
  const body = JSON.stringify({
    sender: { email: sender.email, ...(sender.name ? { name: sender.name } : {}) },
    to: to.map((a) => ({ email: a.email, ...(a.name ? { name: a.name } : {}) })),
    ...(replyTo ? { replyTo: { email: replyTo.email, ...(replyTo.name ? { name: replyTo.name } : {}) } } : {}),
    subject: opts.subject,
    htmlContent: opts.html,
    textContent: opts.text,
  });

  let lastError = 'Unknown error';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': config.mail.brevoApiKey, 'content-type': 'application/json', accept: 'application/json' },
        body,
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      const data = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string };
      if (res.ok) return data.messageId;
      lastError = `Brevo API ${res.status}: ${data.message ?? res.statusText}`;
      if (!(res.status === 429 || res.status >= 500)) break; // 4xx cannot be fixed by retrying
    } catch (err) {
      lastError = `Could not reach Brevo: ${(err as Error).message}`;
    }
    if (attempt < 3) await sleep(500 * 2 ** (attempt - 1));
  }
  throw new Error(lastError);
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (transporter) return transporter;
  const { smtp } = config.mail;
  transporter = nodemailer.createTransport({
    // a well-known service (gmail ...) supplies host, port and TLS itself
    ...(smtp.host ? { host: smtp.host, port: smtp.port, secure: smtp.secure } : { service: smtp.service }),
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    // fail fast instead of hanging a request when the network blocks SMTP
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

/** Sends one email. Rejects with a readable error when the provider refuses or the network blocks it. */
export async function sendMail(opts: MailOptions): Promise<void> {
  const toLabel = parseAddrs(opts.to).map((a) => a.email).join(', ');
  if (!mailConfigured()) {
    const error = 'Email is not configured on the server.';
    record({ ok: false, to: toLabel, error });
    logger.warn(`[mail] NOT SENT to ${toLabel}: ${error} ${mailProblems().join(' ')}`);
    throw new Error(error);
  }

  if (mailMode() === 'brevo-api') {
    try {
      const messageId = await sendViaBrevo(opts);
      record({ ok: true, to: toLabel, messageId });
      logger.info(`[mail] Brevo accepted "${opts.subject}" for ${toLabel} (messageId ${messageId ?? 'n/a'})`);
      trackDelivery(messageId, toLabel);
      return;
    } catch (e) {
      record({ ok: false, to: toLabel, error: (e as Error).message });
      logger.error(`[mail] Brevo REFUSED "${opts.subject}" for ${toLabel}: ${(e as Error).message}`);
      throw e;
    }
  }

  const from = senderAddress()!;
  const failure = await getTransporter()
    .sendMail({
      from: from.name ? { name: from.name, address: from.email } : from.email,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    })
    .then(() => null, (e: unknown) => e as NodeJS.ErrnoException);
  if (failure) {
    const blocked = ['ETIMEDOUT', 'ECONNREFUSED', 'ESOCKET', 'ENETUNREACH'].includes(String(failure.code));
    const error = `${failure.message}${blocked ? ' The network may be blocking outbound SMTP (the Render free plan does). See the README for options.' : ''}`;
    record({ ok: false, to: toLabel, error });
    logger.error(`[mail] SMTP failed for ${toLabel}: ${error}`);
    throw new Error(error);
  }
  record({ ok: true, to: toLabel });
  logger.info(`[mail] SMTP accepted "${opts.subject}" for ${toLabel}`);
}

/** One line at startup so the Render logs show how mail is configured (never the secret itself). */
export function logMailConfig(): void {
  const mode = mailMode();
  const key = config.mail.brevoApiKey;
  logger.info(`[mail] mode=${mode} from="${config.mail.from || '(not set)'}" to=${config.mail.to.join(',') || '(CMS Contact details)'} apiKey=${key ? `set (${key.length} chars, starts ${key.slice(0, 6)}...)` : 'NOT SET'}`);
  mailProblems().forEach((p) => logger.warn(`[mail] ${p}`));
  // Ask Brevo which account this key belongs to and whether the sender/domain are usable (non-blocking)
  if (mode === 'brevo-api') void logBrevoDiagnosis().catch((e) => logger.warn(`[mail] Brevo diagnosis failed: ${(e as Error).message}`));
}

/** Fire-and-forget wrapper used by request handlers: never throws, logs failures. */
export function logMailFailure(context: string, e: unknown): void {
  logger.error(`Email failed (${context}): ${(e as Error).message}`);
}
