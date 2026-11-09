import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import config from '../../config/env';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { createValidationError } from '../../utils/app-error';
import { classifyChannel, countryName, isBot, locate, parseUserAgent } from './classify';
import { Hit } from './model';

const collectLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Slow down', code: 'RATE_LIMITED' } });

const id = Joi.string().trim().pattern(/^[A-Za-z0-9_-]{8,64}$/);
const short = (n: number) => Joi.string().trim().allow('').max(n);

const collectSchema = Joi.object({
  type: Joi.string().valid('pageview', 'ping', 'event').required(),
  pid: id,
  vid: id.required(),
  sid: id.required(),
  path: Joi.string().trim().max(300).pattern(/^\//).default('/'),
  title: short(200),
  entry: Joi.boolean().default(false),
  ref: short(500),
  utm: Joi.object({ source: short(100), medium: short(100), campaign: short(150) }).default({}),
  screen: short(20),
  lang: short(20),
  duration: Joi.number().min(0).max(4 * 3600),
  name: short(60),
  label: short(200),
});

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const MAX_RANGE_DAYS = 800;

/** Host filter for reports: the production site by default, or "all" for every site (including localhost). */
function hostFilter(req: Request): Record<string, string> {
  const raw = typeof req.query.host === 'string' ? req.query.host.trim().toLowerCase().replace(/^www\./, '') : '';
  if (raw === 'all') return {};
  return { host: raw || config.analytics.siteHost };
}

/** Local-time bucket key (YYYY-MM-DD, YYYY-MM-DD HH:00 or YYYY-MM) for gap filling. */
function bucketKey(d: Date, tz: string, interval: Interval): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  if (interval === 'hour') return `${p.year}-${p.month}-${p.day} ${p.hour}:00`;
  if (interval === 'month') return `${p.year}-${p.month}`;
  return `${p.year}-${p.month}-${p.day}`;
}

type Interval = 'hour' | 'day' | 'month';
const FORMAT: Record<Interval, string> = { hour: '%Y-%m-%d %H:00', day: '%Y-%m-%d', month: '%Y-%m' };

function parseRange(req: Request) {
  const from = new Date(String(req.query.from ?? ''));
  const to = new Date(String(req.query.to ?? ''));
  const tz = typeof req.query.tz === 'string' && req.query.tz ? req.query.tz : 'Asia/Kolkata';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
  } catch {
    throw createValidationError('Invalid timezone');
  }
  if (isNaN(+from) || isNaN(+to) || from >= to) throw createValidationError('from and to must be valid ISO dates with from before to');
  const days = (+to - +from) / 86400000;
  if (days > MAX_RANGE_DAYS) throw createValidationError(`Range cannot exceed ${MAX_RANGE_DAYS} days`);
  const interval: Interval = days <= 2.01 ? 'hour' : days <= 190 ? 'day' : 'month';
  return { from, to, tz, interval, days };
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

async function sessionTotals(from: Date, to: Date, site: Record<string, string>) {
  const [r] = await Hit.aggregate([
    { $match: { type: 'pageview', ts: { $gte: from, $lt: to }, ...site } },
    { $group: { _id: '$sid', views: { $sum: 1 }, dur: { $sum: '$duration' }, vid: { $first: '$vid' } } },
    {
      $group: {
        _id: null,
        sessions: { $sum: 1 },
        views: { $sum: '$views' },
        bounces: { $sum: { $cond: [{ $eq: ['$views', 1] }, 1, 0] } },
        dur: { $sum: '$dur' },
        visitors: { $addToSet: '$vid' },
      },
    },
    { $project: { _id: 0, sessions: 1, views: 1, bounces: 1, dur: 1, visitors: { $size: '$visitors' } } },
  ]).allowDiskUse(true);
  const t = r ?? { sessions: 0, views: 0, bounces: 0, dur: 0, visitors: 0 };
  return {
    pageviews: t.views as number,
    visitors: t.visitors as number,
    sessions: t.sessions as number,
    bounceRate: pct(t.bounces, t.sessions),
    avgSessionSeconds: t.sessions ? Math.round(t.dur / t.sessions) : 0,
    pagesPerSession: t.sessions ? Math.round((t.views / t.sessions) * 100) / 100 : 0,
  };
}

export async function buildReport(from: Date, to: Date, tz: string, interval: Interval, days: number, site: Record<string, string> = {}) {
  const pv = { type: 'pageview', ts: { $gte: from, $lt: to }, ...site };
  const entries = { ...pv, isEntry: true };
  const prevFrom = new Date(+from - (+to - +from));
  const topBy = (match: object, field: string, limit = 10, extra: Record<string, unknown> = {}) =>
    Hit.aggregate([
      { $match: match },
      { $group: { _id: `$${field}`, views: { $sum: 1 }, visitors: { $addToSet: '$vid' }, ...extra } },
      { $project: { views: 1, visitors: { $size: '$visitors' }, ...Object.fromEntries(Object.keys(extra).map((k) => [k, 1])) } },
      { $sort: { visitors: -1, views: -1 } },
      { $limit: limit },
    ]);

  const [totals, previous, vids, series, pages, entryPages, exitPages, countries, cities, referrers, channels, campaigns, devices, browsers, systems, screens, languages, heat, eventList, eventLabels] = await Promise.all([
    sessionTotals(from, to, site),
    sessionTotals(prevFrom, from, site),
    Hit.distinct('vid', pv),
    Hit.aggregate([
      { $match: pv },
      { $group: { _id: { $dateToString: { format: FORMAT[interval], date: '$ts', timezone: tz } }, pageviews: { $sum: 1 }, visitors: { $addToSet: '$vid' }, sessions: { $addToSet: '$sid' } } },
      { $project: { pageviews: 1, visitors: { $size: '$visitors' }, sessions: { $size: '$sessions' } } },
    ]),
    Hit.aggregate([
      { $match: pv },
      { $group: { _id: '$path', views: { $sum: 1 }, visitors: { $addToSet: '$vid' }, entries: { $sum: { $cond: ['$isEntry', 1, 0] } }, durSum: { $sum: '$duration' }, durN: { $sum: { $cond: [{ $gt: ['$duration', 0] }, 1, 0] } } } },
      { $project: { views: 1, entries: 1, visitors: { $size: '$visitors' }, avgSeconds: { $cond: [{ $gt: ['$durN', 0] }, { $round: [{ $divide: ['$durSum', '$durN'] }, 0] }, 0] } } },
      { $sort: { views: -1 } },
      { $limit: 15 },
    ]),
    topBy(entries, 'path', 8),
    Hit.aggregate([
      { $match: pv },
      { $sort: { ts: 1 } },
      { $group: { _id: '$sid', path: { $last: '$path' } } },
      { $group: { _id: '$path', sessions: { $sum: 1 } } },
      { $sort: { sessions: -1 } },
      { $limit: 8 },
    ]).allowDiskUse(true),
    topBy(pv, 'country', 25),
    Hit.aggregate([
      { $match: { ...pv, city: { $ne: '' } } },
      { $group: { _id: { city: '$city', country: '$country' }, views: { $sum: 1 }, visitors: { $addToSet: '$vid' } } },
      { $project: { views: 1, visitors: { $size: '$visitors' } } },
      { $sort: { visitors: -1, views: -1 } },
      { $limit: 10 },
    ]),
    topBy({ ...entries, refHost: { $ne: '' } }, 'refHost', 10),
    topBy(entries, 'channel', 10),
    Hit.aggregate([
      { $match: { ...entries, $or: [{ utmCampaign: { $ne: '' } }, { utmSource: { $ne: '' } }] } },
      { $group: { _id: { campaign: '$utmCampaign', source: '$utmSource', medium: '$utmMedium' }, sessions: { $sum: 1 }, visitors: { $addToSet: '$vid' } } },
      { $project: { sessions: 1, visitors: { $size: '$visitors' } } },
      { $sort: { sessions: -1 } },
      { $limit: 10 },
    ]),
    topBy(entries, 'device', 5),
    topBy(entries, 'browser', 8),
    topBy(entries, 'os', 8),
    topBy({ ...entries, screen: { $ne: '' } }, 'screen', 8),
    topBy({ ...entries, language: { $ne: '' } }, 'language', 8),
    Hit.aggregate([
      { $match: pv },
      { $group: { _id: { dow: { $dayOfWeek: { date: '$ts', timezone: tz } }, hour: { $hour: { date: '$ts', timezone: tz } } }, views: { $sum: 1 } } },
    ]),
    Hit.aggregate([
      { $match: { type: 'event', ts: { $gte: from, $lt: to }, ...site } },
      { $group: { _id: '$name', count: { $sum: 1 }, visitors: { $addToSet: '$vid' }, sessions: { $addToSet: '$sid' } } },
      { $project: { count: 1, visitors: { $size: '$visitors' }, sessions: { $size: '$sessions' } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Hit.aggregate([
      { $match: { type: 'event', label: { $ne: '' }, ts: { $gte: from, $lt: to }, ...site } },
      { $group: { _id: { name: '$name', label: '$label' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),
  ]);

  // New vs returning visitors: anyone seen before the range counts as returning.
  const returningIds = vids.length ? await Hit.distinct('vid', { vid: { $in: vids }, ts: { $lt: from }, ...site }) : [];
  const returning = returningIds.length;

  // Timeseries with empty buckets filled.
  const byKey = new Map<string, { pageviews: number; visitors: number; sessions: number }>(series.map((s: any) => [s._id as string, s]));
  const step = interval === 'hour' ? 3600000 : 86400000;
  const timeseries: { bucket: string; pageviews: number; visitors: number; sessions: number }[] = [];
  const seen = new Set<string>();
  for (let t = +from; t < +to; t += step) {
    const key = bucketKey(new Date(t), tz, interval);
    if (seen.has(key)) continue;
    seen.add(key);
    const row = byKey.get(key);
    timeseries.push({ bucket: key, pageviews: row?.pageviews ?? 0, visitors: row?.visitors ?? 0, sessions: row?.sessions ?? 0 });
  }

  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  heat.forEach((h: any) => (heatmap[h._id.dow - 1][h._id.hour] = h.views)); // 0 = Sunday

  const conv = (name: string) => eventList.find((e: any) => e._id === name)?.sessions ?? 0;
  const enquirySessions = conv('enquiry_submit');

  const sites = await Hit.aggregate([{ $group: { _id: '$host', hits: { $sum: 1 } } }, { $sort: { hits: -1 } }]);

  return {
    site: site.host ?? 'all',
    sites: sites.filter((x: any) => x._id).map((x: any) => ({ host: x._id as string, hits: x.hits as number })),
    range: { from, to, tz, interval, days: Math.round(days * 10) / 10 },
    summary: {
      ...totals,
      newVisitors: Math.max(totals.visitors - returning, 0),
      returningVisitors: returning,
      returningRate: pct(returning, totals.visitors),
      enquiries: eventList.find((e: any) => e._id === 'enquiry_submit')?.count ?? 0,
      conversionRate: pct(enquirySessions, totals.sessions),
    },
    previous,
    timeseries,
    pages: pages.map((p: any) => ({ path: p._id, views: p.views, visitors: p.visitors, entries: p.entries, avgSeconds: p.avgSeconds })),
    entryPages: entryPages.map((p: any) => ({ path: p._id, sessions: p.views, visitors: p.visitors })),
    exitPages: exitPages.map((p: any) => ({ path: p._id, sessions: p.sessions })),
    countries: countries.map((c: any) => ({ code: c._id, name: countryName(c._id), views: c.views, visitors: c.visitors })),
    cities: cities.map((c: any) => ({ city: c._id.city, country: c._id.country, countryName: countryName(c._id.country), views: c.views, visitors: c.visitors })),
    referrers: referrers.map((r: any) => ({ host: r._id, sessions: r.views, visitors: r.visitors })),
    channels: channels.map((c: any) => ({ channel: c._id, sessions: c.views, visitors: c.visitors })),
    campaigns: campaigns.map((c: any) => ({ campaign: c._id.campaign || '(none)', source: c._id.source || '-', medium: c._id.medium || '-', sessions: c.sessions, visitors: c.visitors })),
    devices: devices.map((d: any) => ({ name: d._id, sessions: d.views })),
    browsers: browsers.map((d: any) => ({ name: d._id, sessions: d.views })),
    systems: systems.map((d: any) => ({ name: d._id, sessions: d.views })),
    screens: screens.map((d: any) => ({ name: d._id, sessions: d.views })),
    languages: languages.map((d: any) => ({ name: d._id, sessions: d.views })),
    heatmap,
    events: eventList.map((e: any) => ({ name: e._id, count: e.count, visitors: e.visitors, sessions: e.sessions })),
    eventLabels: eventLabels.map((e: any) => ({ name: e._id.name, label: e._id.label, count: e.count })),
  };
}

class AnalyticsRoutes implements Routes {
  public path = '/api';
  public router = Router();

  constructor() {
    const guard = [requireAuth, requireAdmin];

    // ---- Public collector (cookie-less, no IP stored) ----
    this.router.post(`${this.path}/public/analytics/collect`, collectLimiter, validateBody(collectSchema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ua = String(req.headers['user-agent'] ?? '');
        if (isBot(ua) || req.headers.dnt === '1') {
          res.status(204).end();
          return;
        }
        const b = req.body;
        const now = new Date();

        if (b.type === 'ping') {
          if (b.pid) await Hit.updateOne({ pid: b.pid, vid: b.vid }, { $max: { duration: Math.round(b.duration ?? 0), seen: now } });
          res.status(204).end();
          return;
        }

        const { device, browser, os } = parseUserAgent(ua);
        const geo = locate(req);
        const refHost = b.entry ? hostOf(b.ref) : '';
        const own = (req.headers.origin as string | undefined) ? hostOf(req.headers.origin as string) : '';
        const externalRef = refHost && refHost !== own ? refHost : '';

        await Hit.create({
          ts: now,
          seen: now,
          type: b.type,
          host: own,
          pid: b.pid,
          vid: b.vid,
          sid: b.sid,
          path: b.path.split('?')[0].slice(0, 300),
          title: b.title,
          isEntry: b.type === 'pageview' && b.entry,
          duration: 0,
          refHost: externalRef,
          refUrl: externalRef ? String(b.ref).slice(0, 300) : '',
          channel: b.entry ? classifyChannel(externalRef, b.utm.source ?? '', b.utm.medium ?? '') : 'Direct',
          utmSource: (b.utm.source ?? '').toLowerCase(),
          utmMedium: (b.utm.medium ?? '').toLowerCase(),
          utmCampaign: b.utm.campaign ?? '',
          ...geo,
          device,
          browser,
          os,
          screen: b.screen,
          language: (b.lang ?? '').slice(0, 2).toLowerCase(),
          name: b.type === 'event' ? b.name : '',
          label: b.type === 'event' ? b.label : '',
        });
        res.status(204).end();
      } catch (e) {
        next(e);
      }
    });

    // ---- Admin reports ----
    this.router.get(`${this.path}/admin/analytics/overview`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { from, to, tz, interval, days } = parseRange(req);
        res.status(200).json({ data: await buildReport(from, to, tz, interval, days, hostFilter(req)) });
      } catch (e) {
        next(e);
      }
    });

    this.router.get(`${this.path}/admin/analytics/realtime`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const now = new Date();
        const site = hostFilter(req);
        const active = { type: 'pageview', seen: { $gte: new Date(+now - 5 * 60000) }, ...site };
        const [visitors, pages, countries, devices, perMinute, recent, today] = await Promise.all([
          Hit.distinct('vid', active),
          Hit.aggregate([{ $match: active }, { $group: { _id: '$path', visitors: { $addToSet: '$vid' } } }, { $project: { visitors: { $size: '$visitors' } } }, { $sort: { visitors: -1 } }, { $limit: 6 }]),
          Hit.aggregate([{ $match: active }, { $group: { _id: '$country', visitors: { $addToSet: '$vid' } } }, { $project: { visitors: { $size: '$visitors' } } }, { $sort: { visitors: -1 } }, { $limit: 6 }]),
          Hit.aggregate([{ $match: active }, { $group: { _id: '$device', visitors: { $addToSet: '$vid' } } }, { $project: { visitors: { $size: '$visitors' } } }]),
          Hit.aggregate([
            { $match: { type: 'pageview', ts: { $gte: new Date(+now - 30 * 60000) }, ...site } },
            { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'minute' } }, views: { $sum: 1 } } },
          ]),
          Hit.find({ ts: { $gte: new Date(+now - 60 * 60000) }, ...site }).sort({ ts: -1 }).limit(12).select('ts type path name label country city').lean(),
          Hit.countDocuments({ type: 'pageview', ts: { $gte: new Date(new Date(now).setHours(0, 0, 0, 0)) }, ...site }),
        ]);
        const minutes = new Map<number, number>(perMinute.map((m: any) => [+new Date(m._id), m.views]));
        const base = Math.floor(+now / 60000) * 60000;
        res.status(200).json({
          data: {
            activeVisitors: visitors.length,
            pagesToday: today,
            pages: pages.map((p: any) => ({ path: p._id, visitors: p.visitors })),
            countries: countries.map((c: any) => ({ code: c._id, name: countryName(c._id), visitors: c.visitors })),
            devices: devices.map((d: any) => ({ name: d._id, visitors: d.visitors })),
            perMinute: Array.from({ length: 30 }, (_, i) => ({ t: new Date(base - (29 - i) * 60000).toISOString(), views: minutes.get(base - (29 - i) * 60000) ?? 0 })),
            recent: recent.map((r: any) => ({ ts: r.ts, type: r.type, path: r.path, name: r.name, label: r.label, country: r.country, city: r.city, countryName: countryName(r.country) })),
          },
        });
      } catch (e) {
        next(e);
      }
    });

    this.router.get(`${this.path}/admin/analytics/export`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { from, to, tz, interval, days } = parseRange(req);
        const r = await buildReport(from, to, tz, interval, days, hostFilter(req));
        const rows = ['date,pageviews,visitors,sessions', ...r.timeseries.map((t) => `${t.bucket},${t.pageviews},${t.visitors},${t.sessions}`)];
        res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="analytics.csv"').status(200).send(rows.join('\n'));
      } catch (e) {
        next(e);
      }
    });

    // Delete all collected data (e.g. before launch).
    this.router.delete(`${this.path}/admin/analytics`, ...guard, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const r = await Hit.deleteMany({});
        res.status(200).json({ data: { deleted: r.deletedCount } });
      } catch (e) {
        next(e);
      }
    });
  }
}

export default AnalyticsRoutes;
