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
