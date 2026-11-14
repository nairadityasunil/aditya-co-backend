import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/** "45 seconds", "1 minute", "7 minutes": a wait a visitor can act on. */
export const humanWait = (ms: number): string => {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
};

interface LimiterOptions {
  windowMs: number;
  max: number;
  /** Start of the visitor-facing sentence, e.g. "You have sent several enquiries in a short time." */
  message: string;
  /** Only successful requests use up the allowance, so a typo or a validation error never costs a visitor a turn. */
  successOnly?: boolean;
  /** Defaults to the client IP. */
  key?: (req: Request) => string;
}

/**
 * One rate limiter whose rejection tells the visitor exactly how long to wait
 * ("... Please try again in 3 minutes.") and returns the wait as `retryAfterSeconds` for the website to use.
 */
export const makeLimiter = ({ windowMs, max, message, successOnly = false, key }: LimiterOptions) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: successOnly,
    ...(key ? { keyGenerator: key } : {}),
    handler: (req, res) => {
      const reset = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
      const waitMs = reset ? Math.max(reset.getTime() - Date.now(), 1000) : windowMs;
      const retryAfterSeconds = Math.ceil(waitMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: `${message} Please try again in ${humanWait(waitMs)}.`, code: 'RATE_LIMITED', retryAfterSeconds });
    },
  });

const MIN = 60 * 1000;

/**
 * Limits for the public enquiry form and chatbot, applied in this order (cheapest first):
 *  1. attempts: every request counts, valid or not, so a script cannot hammer the endpoint with junk;
 *  2. burst: 5 successful enquiries per 5 minutes per IP (was 5 per 15 minutes, counting failures too);
 *  3. hourly: 15 successful enquiries per hour per IP, a ceiling above the burst limit;
 *  4. per email: 3 per 10 minutes for one address, so the automatic thank-you email cannot be used to flood someone's inbox.
 */
export const enquiryAttemptLimiter = makeLimiter({ windowMs: 5 * MIN, max: 30, message: 'Too many attempts from this connection.' });
export const enquiryBurstLimiter = makeLimiter({ windowMs: 5 * MIN, max: 5, successOnly: true, message: 'You have sent several enquiries in a short time.' });
export const enquiryHourlyLimiter = makeLimiter({ windowMs: 60 * MIN, max: 15, successOnly: true, message: 'You have reached the hourly enquiry limit for this connection.' });
export const enquiryEmailLimiter = makeLimiter({
  windowMs: 10 * MIN,
  max: 3,
  successOnly: true,
  message: 'We have already received several enquiries from this email address.',
  key: (req) => String(req.body?.email ?? 'unknown').trim().toLowerCase(),
});
