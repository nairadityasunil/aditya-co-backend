import dns from 'dns/promises';
import net from 'net';
import { NextFunction, Request, Response, Router } from 'express';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { createValidationError } from '../../utils/app-error';

/** True for loopback, private, link-local and other non-public addresses (SSRF protection). */
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::1' || v6 === '::') return true;
  if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIp(mapped[1]) : false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw createValidationError('Enter a valid URL, including https://');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw createValidationError('Only http and https links are supported');
  if (url.username || url.password) throw createValidationError('Links with credentials are not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw createValidationError('Could not find that website');
  if (addresses.some((a) => isPrivateIp(a.address))) throw createValidationError('That address is not allowed');
  return url;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .trim();

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decode(content);
  }
  return '';
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

/** Fetches a page (following up to 3 public redirects) and reads its Open Graph / meta tags, like a WhatsApp link card. */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let url = await assertPublicUrl(rawUrl);
  let res: globalThis.Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdityaCoLinkPreview/1.0)', Accept: 'text/html,application/xhtml+xml' },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location') as string, url).toString());
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw createValidationError('The website did not respond. Check the link and try again.');
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('html')) throw createValidationError('That link is not a web page');

  // Read at most ~512 KB, enough for the <head>
  const reader = res.body?.getReader();
  let html = '';
  if (reader) {
    const decoder = new TextDecoder();
    let size = 0;
    while (size < 512 * 1024) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    void reader.cancel().catch(() => undefined);
  }

  const title = metaContent(html, ['og:title', 'twitter:title']) || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '');
  const description = metaContent(html, ['og:description', 'twitter:description', 'description']);
  const imageRaw = metaContent(html, ['og:image', 'og:image:url', 'twitter:image']);
  let image = '';
  if (imageRaw) {
    try {
      image = new URL(imageRaw, url).toString();
    } catch {
      image = '';
    }
  }
  return { url: url.toString(), title, description, image, siteName: metaContent(html, ['og:site_name']) };
}

class PreviewRoutes implements Routes {
  public path = '/api';
  public router = Router();

  constructor() {
    this.router.get(`${this.path}/admin/link-preview`, requireAuth, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
        if (!url) throw createValidationError('url is required');
        res.status(200).json({ data: await fetchLinkPreview(url) });
      } catch (e) {
        next(e);
      }
    });
  }
}

export default PreviewRoutes;
