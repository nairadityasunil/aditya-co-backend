import config from '../config/env';
import logger from '../utils/logger';

const API = 'https://api.brevo.com/v3';

/** One GET against Brevo's API with the configured key. Never throws. */
async function brevoGet<T = any>(path: string): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { 'api-key': config.mail.brevoApiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) return { ok: false, status: res.status, error: data?.message ?? res.statusText };
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
}

const senderEmail = (): string => (config.mail.from.match(/<([^>]+)>/)?.[1] ?? config.mail.from).trim().toLowerCase();

export interface BrevoDiagnosis {
  keyWorks: boolean;
  account?: { email?: string; company?: string; name?: string };
  plan?: { type?: string; creditsLeft?: number }[];
  sender: string;
  senderListed?: boolean;
  senderActive?: boolean;
  domain?: string;
  domainAuthenticated?: boolean;
  findings: string[];
}

/**
 * Asks Brevo who this API key belongs to and whether the sender and domain are usable.
 * "Brevo accepted the email" (a messageId) only proves the key is valid for SOME account, so this
 * shows which account that is, and whether the sender/domain would actually deliver.
 */
export async function diagnoseBrevo(): Promise<BrevoDiagnosis> {
  const sender = senderEmail();
  const domain = sender.split('@')[1] ?? '';
  const out: BrevoDiagnosis = { keyWorks: false, sender, domain, findings: [] };

  if (!config.mail.brevoApiKey) {
    out.findings.push('BREVO_API_KEY is not set.');
    return out;
  }

  const acct = await brevoGet('/account');
  if (!acct.ok) {
    out.findings.push(`Brevo rejected the API key (${acct.status}): ${acct.error}`);
    return out;
  }
  out.keyWorks = true;
  const a = acct.data;
  out.account = { email: a.email, company: a.companyName, name: [a.firstName, a.lastName].filter(Boolean).join(' ') || undefined };
  out.plan = (a.plan ?? []).map((p: any) => ({ type: p.type, creditsLeft: p.credits }));
  out.findings.push(`This API key belongs to the Brevo account ${a.email}${a.companyName ? ` (${a.companyName})` : ''}. Sent emails appear in THAT account's Transactional logs and plan usage.`);
  const sendLimit = (a.plan ?? []).find((p: any) => /send/i.test(p.creditsType ?? '') || p.type === 'free');
  if (sendLimit) out.findings.push(`Plan: ${sendLimit.type}, ${sendLimit.credits} emails left in the current period.`);

  const senders = await brevoGet<{ senders?: { email: string; active: boolean }[] }>('/senders');
  if (senders.ok) {
    const found = (senders.data?.senders ?? []).find((s) => s.email.toLowerCase() === sender);
    out.senderListed = !!found;
    out.senderActive = found?.active;
    if (!found) out.findings.push(`Sender ${sender} is NOT in this Brevo account's senders list. Add and verify it (Senders, Domains & Dedicated IPs -> Senders).`);
    else if (!found.active) out.findings.push(`Sender ${sender} exists but is NOT active/verified yet. Open the confirmation email Brevo sent to it.`);
    else out.findings.push(`Sender ${sender} is listed and active.`);
  } else {
    out.findings.push(`Could not read the senders list (${senders.status}): ${senders.error}`);
  }

  const domains = await brevoGet<{ domains?: { domain_name: string; authenticated?: boolean; verified?: boolean }[] }>('/senders/domains');
  if (domains.ok) {
    const d = (domains.data?.domains ?? []).find((x) => x.domain_name?.toLowerCase() === domain);
    out.domainAuthenticated = !!d?.authenticated;
    if (!d) out.findings.push(`Domain ${domain} is NOT added in this Brevo account. Without domain authentication (DKIM/DMARC) Gmail often spams or rejects the mail.`);
    else if (!d.authenticated) out.findings.push(`Domain ${domain} is added but NOT authenticated yet. Add the DNS records Brevo shows and press Authenticate.`);
    else out.findings.push(`Domain ${domain} is authenticated.`);
  } else {
    out.findings.push(`Could not read the domains list (${domains.status}): ${domains.error}`);
  }
  return out;
}

export async function logBrevoDiagnosis(): Promise<BrevoDiagnosis> {
  const d = await diagnoseBrevo();
  d.findings.forEach((f) => (/NOT|rejected|Could not|not set/.test(f) ? logger.warn(`[mail] ${f}`) : logger.info(`[mail] ${f}`)));
  return d;
}

/**
 * Brevo accepting a message is not delivery. A little after sending, ask Brevo what actually
 * happened to it (delivered, blocked, bounced, deferred, spam ...) and log the reason.
 */
export function trackDelivery(messageId: string | undefined, to: string): void {
  if (!messageId || process.env.MAIL_TRACK_DELIVERY === 'false') return;
  const timer = setTimeout(async () => {
    const r = await brevoGet<{ events?: { event: string; email: string; reason?: string; date?: string }[] }>(`/smtp/statistics/events?messageId=${encodeURIComponent(messageId)}&sort=desc&limit=20`);
    if (!r.ok) {
      logger.warn(`[mail] could not look up delivery of ${messageId}: ${r.status} ${r.error}`);
      return;
    }
    const events = r.data?.events ?? [];
    if (events.length === 0) {
      logger.warn(`[mail] Brevo has NO events for ${messageId} (to ${to}) after 20s. If it is absent in the Brevo dashboard too, the API key belongs to a different Brevo account than the one you are viewing.`);
      return;
    }
    events.forEach((e) => {
      const line = `[mail] delivery ${messageId} -> ${e.email}: ${e.event}${e.reason ? ` (${e.reason})` : ''}`;
      if (/delivered|opened|clicks|requests/i.test(e.event)) logger.info(line);
      else logger.warn(line);
    });
  }, 20_000);
  timer.unref?.();
}
