# Aditya & Co. CMS Backend

Express + TypeScript + MongoDB API that powers the Aditya & Co. website and its admin CMS.
Same architecture as the portfolio CMS: JWT admin auth, Cloudinary uploads, `/api/public/*` for the website and `/api/admin/*` (JWT) for the CMS.

## Run

```bash
cp .env.example .env     # set MONGODB_URI, JWT_SECRET, Cloudinary keys
npm install
npm run seed             # first admin (forced to change credentials on login) + starter content
npm run dev
```

`npm run seed` only fills empty collections, so it never overwrites edits. `npm run seed -- --reset-admin` recreates the admin user.

## Content managed

| Collection | Admin path | Public path |
|---|---|---|
| Stats (editable numbers) | `/api/admin/stats` | `/api/public/stats` |
| Software services | `/api/admin/software-services` | `/api/public/software-services` |
| Software portfolio | `/api/admin/projects` | `/api/public/projects` |
| Achievements | `/api/admin/achievements` | `/api/public/achievements` |
| Gallery | `/api/admin/gallery` | `/api/public/gallery` |
| Leadership (Founder & CEO, CTO + ideology) | `/api/admin/team` | `/api/public/team` |
| Site settings (contact details) | `/api/admin/settings` | `/api/public/settings` |
| Enquiries (contact form) | `/api/admin/enquiries` | `POST /api/public/enquiries` |

Every collection supports `GET`, `POST`, `PATCH /:id`, `DELETE /:id` and `POST /reorder` under `/api/admin/...`.
`GET /api/public/site` returns everything the website needs in one request.
Uploads: `POST /api/admin/upload/single` (multipart `file`).

Cloudinary credentials come from the environment only.

## Media library & video upload

All endpoints are admin-only (`Authorization: Bearer <jwt>`) and scoped to `CLOUDINARY_FOLDER`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/media/rules` | Upload limits (formats, max size, max video seconds, chunk size) to validate against in the UI |
| GET | `/api/admin/media?type=all\|image\|video\|raw&search=&limit=&cursor=&sort=newest\|oldest` | Browse/search the library (cursor pagination via `meta.nextCursor`) |
| GET | `/api/admin/media/detail?publicId=&resourceType=` | Asset detail + gallery items using it |
| GET | `/api/admin/media/usage` | Cloudinary plan usage |
| POST | `/api/admin/media/sign` | Validate a file and get a signed direct-upload payload |
| POST | `/api/admin/media/finalize` | Verify the uploaded asset (size/format/duration); deletes it and returns 422 if invalid |
| DELETE | `/api/admin/media` | Bulk delete `{ items: [{ publicId, resourceType }], force? }` — 409 if used by gallery unless `force` |

### Upload flow (with progress)
Files go **browser → Cloudinary directly**, so large videos never pass through this server and the browser gets real progress events.

1. `POST /sign` with `{ resourceType, fileName, mimeType, size }` → `{ uploadUrl, apiKey, signature, params, publicId, chunkBytes }`. Invalid files are rejected here with `422 UPLOAD_REJECTED`.
2. Upload with `XMLHttpRequest` to `uploadUrl` as `multipart/form-data` containing `file`, `api_key`, `signature` and every key in `params`. Use `xhr.upload.onprogress` (`loaded / total`) for the progress bar. For videos larger than `chunkBytes`, send slices with `Content-Range: bytes start-end/total` and a shared `X-Unique-Upload-Id` header; sum completed chunks plus the current chunk's `loaded` for overall progress. Support cancel with `xhr.abort()`.
3. `POST /finalize` with `{ publicId, resourceType }` → normalized asset (`url`, `thumbnail`, `duration`, `bytes`, …).
4. Create the gallery item: `POST /api/admin/gallery` with `{ mediaType: "video", video: { publicId, url, thumbnail, duration, bytes, format, width, height }, caption, category }` (images keep using `{ image }`).

Limits are configurable: `MEDIA_IMAGE_MAX_MB` (10), `MEDIA_VIDEO_MAX_MB` (100), `MEDIA_VIDEO_MAX_SECONDS` (180). Videos: mp4, mov, webm, m4v.

## Analytics

First-party, cookie-less analytics collected from the public site (no IP addresses stored; bots, Do-Not-Track browsers and signed-in admins are ignored). Raw data is kept for 2 years.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/public/analytics/collect` | Beacon from the website: `pageview`, `ping` (time on page / heartbeat) and `event` |
| GET | `/api/admin/analytics/overview?from=&to=&tz=` | Full report: totals vs previous period, time series, pages, entry/exit, countries, cities, channels, referrers, UTM campaigns, devices, browsers, OS, screens, languages, weekday x hour heatmap, events and conversion |
| GET | `/api/admin/analytics/realtime` | Visitors active in the last 5 minutes, live pages/countries, per-minute views, latest activity |
| GET | `/api/admin/analytics/export?from=&to=&tz=` | CSV of the time series |
| DELETE | `/api/admin/analytics` | Wipe all collected data (clear test traffic) |

Country comes from the `CF-IPCountry` / `X-Vercel-IP-Country` header when present, otherwise a local GeoIP database (`geoip-lite`). Visitors are unique per browser (random id in localStorage); a visit ends after 30 minutes idle.

Reports default to the live site (`ANALYTICS_SITE_HOST`, default `adityaco.co.in`; `www.` is treated as the same site). Every hit stores the website it came from (the browser's `Origin`), so local testing (`localhost`) is kept apart; pass `?host=all` or another hostname to change the filter. For the live site to be tracked, the deployed backend must allow it in `ALLOWED_ORIGINS` and the deployed frontend needs `VITE_API_BASE_URL` pointing at that backend.

### Gallery paging and video thumbnails
- `GET /api/public/gallery?page=1&limit=20&category=Port` returns one page plus `meta: { total, page, pages, facets }` (`facets` = the categories for the filter buttons). Without `page`/`limit` it still returns the full list.
- Gallery items store `width`/`height` so the site can size tiles (masonry) before images load.
- A video's thumbnail is a random frame (between 8% and 92% of its length) chosen when it is uploaded. `POST /api/admin/media/thumbnail { publicId }` picks another one. The video file itself is only requested by the browser when a visitor opens it.

## Website chatbot

A simple guided assistant on the public site (no AI): visitors press buttons for common questions, and it can collect their details step by step and send them as an enquiry (saved in the CMS Enquiries inbox with source "chatbot", and emailed like the contact form). The menu and wording are edited under **Chatbot** in the CMS.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/public/chatbot` | The widget's menu: name, greeting, topics, enquiry wording |
| GET/PATCH | `/api/admin/chatbot` | Edit the menu and wording (plus the built-in defaults for "reset") |

Each topic is a menu button that either shows an answer, starts the enquiry form, or shows contact buttons. Answers can use placeholders filled in from the live CMS content: `{shippingServices}`, `{softwareServices}`, `{products}`, `{phone}`, `{whatsapp}`, `{email}`, `{address}`. Button presses are recorded as analytics events (`chat_button`), and finished enquiries count as `enquiry_submit`.

## Email for enquiries (plain Nodemailer over SMTP)

Every enquiry (contact form or chatbot) is saved first, then emailed in the background with Nodemailer: one email to the team (Reply goes straight to the visitor) and a confirmation to the visitor. The outcome is stored on each enquiry and shown in the CMS under **Enquiries**, which also has a **Send test email** button.

No third-party sending service is needed, any mailbox with SMTP access works. Set these in the backend environment:

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT` | Your mail server, e.g. `smtp.yourdomain.com` and `587`. Port 465 is treated as TLS automatically |
| `SMTP_SERVICE` | Shortcut instead of host/port for well-known providers, e.g. `gmail` |
| `SMTP_USER`, `SMTP_PASS` | The mailbox login. For Gmail use an **App Password** (Google Account > Security > 2-Step Verification > App passwords), not your normal password |
| `MAIL_FROM` | Optional sender, e.g. `Aditya & Co. <info@yourdomain.com>`. Defaults to `SMTP_USER` (Gmail only sends as the logged-in address) |
| `MAIL_TO` | Optional recipients of the new-enquiry email, comma separated. Defaults to the emails under Contact details in the CMS |

Gmail example: `SMTP_SERVICE=gmail`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<app password>`.

**Render's free plan blocks outbound SMTP on ports 25, 465 and 587**, so these logins time out there (it works locally and on a paid Render plan). On the free plan you can either use a mail server that listens on another port (many offer 2525, but Gmail does not), or switch on the optional HTTPS fallback by setting `BREVO_API_KEY` (a free Brevo account, same Nodemailer code, delivered over port 443). The CMS Enquiries page tells you if your current settings will hit this.

Until email is configured the website keeps using EmailJS as before (the server tells the site whether it sent the email, so nobody gets duplicates).

## Email templates (editable in the CMS)

The emails the site sends automatically are stored in the `EmailTemplate` collection and edited in the CMS under **Email templates**:

| Code | When it is sent |
|---|---|
| `ENQUIRY_NOTIFICATION` | To the company when a contact form or chatbot enquiry arrives |
| `ENQUIRY_THANK_YOU` | To the visitor right after they send an enquiry |
| `ENQUIRY_REPLY` | Wraps a reply written in the CMS under Enquiries |
| `TEST_EMAIL` | The "Send test email" button |

Subject and HTML use `{{variable}}` placeholders (each template lists its variables). Values are HTML-escaped and the subject can never contain a line break. The CMS has a live preview with sample data, "Send test" and "Reset to default". Defaults are inserted on first use or by `npm run seed` and are never overwritten afterwards. Switching a template off stops that automatic email; replies and tests always send. If the database cannot be read, the built-in wording in `services/mail.templates.ts` is used so no enquiry email is lost.

API (admin, JWT): `GET /api/admin/email-templates`, `GET|PATCH /api/admin/email-templates/:code`, `POST /api/admin/email-templates/:code/{preview,test,reset}`.

### Brevo quick setup

1. In Brevo, verify your phone, then **SMTP & API -> API Keys** and generate a key.
2. **Senders, Domains & Dedicated IPs**: add and verify a sender, and authenticate your domain (DKIM/DMARC records) for good deliverability.
3. Set `BREVO_API_KEY` and `MAIL_FROM` (`EMAIL_FROM` also works) (for example `Aditya & Co. <info@adityaco.co.in>`), plus `MAIL_TO` if enquiries should go to a specific inbox, then redeploy.
4. In the CMS open **Email templates**, enter your address and press **Send test**.

### If no email arrives

On startup the backend logs one `[mail] mode=... from=... apiKey=...` line, and every send logs `[mail] Brevo accepted ... (messageId ...)` or `[mail] Brevo REFUSED ... <reason>`. Check the Render logs for these first. The CMS Enquiries mail status also shows the last send result. A message Brevo accepted appears under Brevo -> Transactional -> Logs; if it is not there, Brevo never received it.

### Reply-To on emails sent to visitors

Emails to visitors (the thank-you and replies written in the CMS) carry no Reply-To by default, so a reply goes to the From address (for example `info@adityaco.co.in`) and no team member's personal address appears in the visitor's email. To route replies somewhere else, set `MAIL_REPLY_TO` to a public company address. The team notification still replies to the visitor, because that is what lets the team answer them.

### Rate limits on the enquiry form and chatbot

Applied per visitor in this order (`src/middleware/rateLimiters.ts`). A blocked visitor gets a 429 whose message says how long to wait (and `retryAfterSeconds`).

| Limit | Allowance | Counts |
|---|---|---|
| Attempts | 30 per 5 minutes per IP | every request, valid or not |
| Burst | 5 enquiries per 5 minutes per IP | successful enquiries only |
| Hourly | 15 enquiries per hour per IP | successful enquiries only |
| Per email address | 3 per 10 minutes | successful enquiries only, stops the thank-you email being used to flood an inbox |

Mistyped or invalid submissions never use up a visitor's allowance. The counters are in memory, so a redeploy or restart clears them.
