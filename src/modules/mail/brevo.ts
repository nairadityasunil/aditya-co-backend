import config from '../../config/env';
import logger from '../../utils/logger';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: { email: string; name?: string };
  cc?: string[];
  bcc?: string[];
}

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

const API_URL = 'https://api.brevo.com/v3/smtp/email';
const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const isMailConfigured = (): boolean => Boolean(config.email.brevoApiKey && config.email.from);

/**
 * Sends one email through Brevo's HTTP API.
 *
 * Unlike a fire-and-forget helper, this RETURNS the outcome so callers can record and surface
 * failures. Network errors, 429 and 5xx are retried with backoff; other 4xx (bad key, unverified
 * sender, invalid address) fail immediately because retrying cannot fix them.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isMailConfigured()) {
    return { ok: false, error: 'Email is not configured (set BREVO_API_KEY and EMAIL_FROM)' };
  }

  const toList = (Array.isArray(input.to) ? input.to : [input.to]).map((email) => ({ email }));
  const body = JSON.stringify({
    sender: { email: config.email.from, name: config.email.fromName },
    to: toList,
    cc: input.cc?.map((email) => ({ email })),
    bcc: input.bcc?.map((email) => ({ email })),
    replyTo: input.replyTo,
    subject: input.subject,
    htmlContent: input.html,
    textContent: input.text,
  });

  let lastError = 'Unknown error';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'api-key': config.email.brevoApiKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };

      if (res.ok) return { ok: true, messageId: data.messageId };

      lastError = `Brevo ${res.status}: ${data.message ?? res.statusText}`;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable) break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }
    if (attempt < MAX_ATTEMPTS) await sleep(500 * 2 ** (attempt - 1));
  }

  logger.error(`Email send failed: ${lastError}`);
  return { ok: false, error: lastError };
}
