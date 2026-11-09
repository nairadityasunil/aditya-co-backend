import { Request } from 'express';
import geoip from 'geoip-lite';

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|whatsapp|curl|wget|python-requests|axios|node-fetch|go-http|java\/|httpclient|scrapy/i;

export const isBot = (ua: string): boolean => !ua || BOT_RE.test(ua);

export function parseUserAgent(ua: string): { device: string; browser: string; os: string } {
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? 'Tablet' : /mobi|iphone|ipod|android/i.test(ua) ? 'Mobile' : 'Desktop';

  let browser = 'Other';
  if (/edg(e|a|ios)?\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = 'Other';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/cros/i.test(ua)) os = 'ChromeOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  return { device, browser, os };
}

const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave|startpage|ask)\./i;
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|instagram\.com|linkedin\.com|lnkd\.in|twitter\.com|x\.com|t\.co|youtube\.com|youtu\.be|pinterest\.[a-z.]+|reddit\.com|whatsapp\.com|wa\.me|telegram\.[a-z]+|t\.me|threads\.net)$/i;

/** Acquisition channel for the first page of a visit. */
export function classifyChannel(refHost: string, utmSource: string, utmMedium: string): string {
  const medium = utmMedium.toLowerCase();
  if (/^(cpc|ppc|paid|paidsearch|display|banner)/.test(medium)) return 'Paid';
  if (/mail/.test(medium) || /mail/i.test(utmSource)) return 'Email';
  if (/social|sm$/.test(medium)) return 'Social';
  if (refHost) {
    if (SEARCH.test(refHost)) return 'Organic Search';
    if (SOCIAL.test(refHost)) return 'Social';
    return 'Referral';
  }
  if (utmSource) return 'Campaign';
  return 'Direct';
}

export function clientIp(req: Request): string {
  const h = (n: string) => {
    const v = req.headers[n];
    return Array.isArray(v) ? v[0] : v;
  };
  const fwd = h('cf-connecting-ip') || h('x-real-ip') || h('x-forwarded-for')?.split(',')[0].trim();
  return (fwd || req.ip || '').replace(/^::ffff:/, '');
}

/** Country from the CDN/proxy header when present, otherwise a local GeoIP database lookup. */
export function locate(req: Request): { country: string; region: string; city: string } {
  const header = (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country']) as string | undefined;
  const geo = geoip.lookup(clientIp(req));
  const country = (header && /^[A-Z]{2}$/.test(header) && header !== 'XX' && header !== 'T1' ? header : geo?.country) || 'XX';
  return { country, region: geo?.region || '', city: geo?.city || '' };
}

const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const countryName = (code: string): string => {
  if (!code || code === 'XX') return 'Unknown';
  try {
    return names.of(code) || code;
  } catch {
    return code;
  }
};
