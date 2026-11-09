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

## Email (Brevo)

Website enquiries are saved first, then two emails are sent through Brevo: a notification to the company inbox (reply-to is the sender) and a thank-you to the sender. The outcome is stored on the enquiry (`notified`, `acknowledged`, `mailError`) so failures show up in the CMS.

Set up:

1. Create a Brevo account, then **Senders, Domains & Dedicated IPs**: add and verify your domain (add the DKIM/DMARC DNS records Brevo shows) or at least a single sender address.
2. **SMTP & API -> API Keys**: create an API key.
3. Set `BREVO_API_KEY`, `EMAIL_FROM` (a verified sender), `EMAIL_FROM_NAME`, `CONTACT_EMAIL` (who receives enquiries) and `WEBSITE_URL`.
4. Run `npm run seed` (creates the default templates) and send a test from **CMS -> Email templates**.

Templates live in the `EmailTemplate` collection and are edited in the CMS (`/api/admin/email-templates`): subject and HTML use `{{variable}}` placeholders, values are HTML-escaped, the preview renders with sample data, and "Reset to default" restores the built-in version.
