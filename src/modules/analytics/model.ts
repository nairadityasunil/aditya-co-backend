import mongoose, { Schema } from 'mongoose';

/**
 * One row per page view or custom event. Privacy-friendly: no IP address, no cookies.
 * `vid` is a random id the browser keeps in localStorage; `sid` is a per-visit id (30 min idle timeout).
 */
const hitSchema = new Schema(
  {
    ts: { type: Date, default: Date.now },
    type: { type: String, enum: ['pageview', 'event'], required: true },
    pid: { type: String, index: true }, // page-view id, used to attach the time-on-page ping
    vid: { type: String, required: true },
    sid: { type: String, required: true },
    host: { type: String, default: '' }, // website the hit came from, e.g. adityaco.co.in
    path: { type: String, default: '/' },
    title: { type: String, default: '' },
    seen: { type: Date, default: Date.now, index: true }, // last heartbeat, powers the realtime view
    isEntry: { type: Boolean, default: false },
    duration: { type: Number, default: 0 }, // seconds on page
    // acquisition
    refHost: { type: String, default: '' },
    refUrl: { type: String, default: '' },
    channel: { type: String, default: 'Direct' },
    utmSource: { type: String, default: '' },
    utmMedium: { type: String, default: '' },
    utmCampaign: { type: String, default: '' },
    // geo + tech
    country: { type: String, default: 'XX' },
    region: { type: String, default: '' },
    city: { type: String, default: '' },
    device: { type: String, default: 'Desktop' },
    browser: { type: String, default: 'Other' },
    os: { type: String, default: 'Other' },
    screen: { type: String, default: '' },
    language: { type: String, default: '' },
    // custom events
    name: { type: String, default: '' },
    label: { type: String, default: '' },
  },
  { versionKey: false }
);

hitSchema.index({ host: 1, type: 1, ts: -1 });
hitSchema.index({ type: 1, ts: -1 });
hitSchema.index({ vid: 1, ts: -1 });
hitSchema.index({ sid: 1, ts: 1 });
// Keep 2 years of raw data.
hitSchema.index({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 730 });

export const Hit = mongoose.model('AnalyticsHit', hitSchema);
