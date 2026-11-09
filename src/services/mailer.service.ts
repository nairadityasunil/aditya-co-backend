import nodemailer, { Transporter, Transport } from 'nodemailer';
import config from '../config/env';
import logger from '../utils/logger';

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
  if (mode !== 'none' && !senderAddress()) problems.push('MAIL_FROM is not set. Use an address your provider has verified, for example "Aditya & Co. <no-reply@yourdomain.com>".');
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

/** A Nodemailer transport that sends through Brevo's HTTPS API, so it works where SMTP ports are blocked. */
function brevoApiTransport(apiKey: string): Transport {
  return {
    name: 'brevo-https',
    version: '1.0.0',
    send(mail, callback) {
      const data = mail.data as Record<string, unknown>;
      const sender = parseAddrs(data.from)[0];
      const to = parseAddrs(data.to);
      const replyTo = parseAddrs(data.replyTo)[0];
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: sender && { name: sender.name, email: sender.email },
          to: to.map((a) => ({ name: a.name, email: a.email })),
          ...(replyTo ? { replyTo: { name: replyTo.name, email: replyTo.email } } : {}),
          subject: data.subject,
          htmlContent: data.html,
          textContent: data.text,
        }),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      })
        .then(async (res) => {
          const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
          if (!res.ok) throw new Error(`Brevo API ${res.status}: ${body.message ?? res.statusText}`);
          callback(null, { messageId: body.messageId ?? '', envelope: { from: sender?.email, to: to.map((a) => a.email) }, accepted: to.map((a) => a.email), rejected: [], pending: [], response: 'queued' } as never);
        })
        .catch((err: Error) => callback(err, undefined as never));
    },
  };
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (transporter) return transporter;
  const { smtp, brevoApiKey } = config.mail;
  transporter =
    mailMode() === 'brevo-api'
      ? nodemailer.createTransport(brevoApiTransport(brevoApiKey))
      : nodemailer.createTransport({
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
  if (!mailConfigured()) throw new Error('Email is not configured on the server.');
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
    const blocked = mailMode() === 'smtp' && ['ETIMEDOUT', 'ECONNREFUSED', 'ESOCKET', 'ENETUNREACH'].includes(String(failure.code));
    throw new Error(`${failure.message}${blocked ? ' The network may be blocking outbound SMTP (the Render free plan does). See the README for options.' : ''}`);
  }
}

/** Fire-and-forget wrapper used by request handlers: never throws, logs failures. */
export function logMailFailure(context: string, e: unknown): void {
  logger.error(`Email failed (${context}): ${(e as Error).message}`);
}
