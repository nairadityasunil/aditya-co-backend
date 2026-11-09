/**
 * Default email templates. They are written to the database on first use / `npm run seed`.
 * After that the CMS copy is the source of truth, and "Reset to default" restores these.
 *
 * Variables use {{name}}. Values are HTML-escaped when rendered into the HTML body.
 */
export interface TemplateVariable {
  key: string;
  description: string;
  sample: string;
}

export interface DefaultTemplate {
  code: string;
  name: string;
  description: string;
  subject: string;
  html: string;
  variables: TemplateVariable[];
}

const wrap = (inner: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{companyName}}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0a0f1c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#0a0f1c;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:bold;">{{companyName}}</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.6;color:#334155;">
${inner}
</td></tr>
<tr><td style="padding:18px 28px;background:#f5f7fb;font-size:13px;color:#64748b;">
{{companyName}} &middot; Gandhidham, Gujarat, India<br>
<a href="{{websiteUrl}}" style="color:#3f5fe0;">{{websiteUrl}}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

const common: TemplateVariable[] = [
  { key: 'companyName', description: 'Company name', sample: 'Aditya & Co.' },
  { key: 'websiteUrl', description: 'Public website address', sample: 'https://adityaco.co.in' },
];

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    code: 'ENQUIRY_NOTIFICATION',
    name: 'New enquiry (sent to the company)',
    description: 'Sent to the company inbox whenever someone submits the website contact form. Replies go to the sender.',
    subject: 'New enquiry from {{name}}: {{service}}',
    variables: [
      { key: 'name', description: "Sender's name", sample: 'Rahul Sharma' },
      { key: 'email', description: "Sender's email address", sample: 'rahul@example.com' },
      { key: 'phone', description: "Sender's phone (may be empty)", sample: '+91 98765 43210' },
      { key: 'service', description: 'Service the sender is interested in', sample: 'Shipping Agent' },
      { key: 'message', description: "Sender's message", sample: 'We need port agency support for a vessel arriving at Kandla next week.' },
      { key: 'receivedAt', description: 'When the enquiry was received (IST)', sample: '12 Nov 2026, 10:30 am' },
      ...common,
    ],
    html: wrap(`<h2 style="margin:0 0 16px;font-size:22px;color:#0a0f1c;">New website enquiry</h2>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:15px;">
<tr><td style="padding:4px 20px 4px 0;color:#64748b;">Name</td><td><strong>{{name}}</strong></td></tr>
<tr><td style="padding:4px 20px 4px 0;color:#64748b;">Email</td><td><a href="mailto:{{email}}" style="color:#3f5fe0;">{{email}}</a></td></tr>
<tr><td style="padding:4px 20px 4px 0;color:#64748b;">Phone</td><td>{{phone}}</td></tr>
<tr><td style="padding:4px 20px 4px 0;color:#64748b;">Service</td><td>{{service}}</td></tr>
<tr><td style="padding:4px 20px 4px 0;color:#64748b;">Received</td><td>{{receivedAt}}</td></tr>
</table>
<div style="white-space:pre-wrap;border-left:3px solid #3f5fe0;padding-left:14px;color:#0a0f1c;">{{message}}</div>
<p style="margin:24px 0 0;font-size:14px;color:#64748b;">Reply to this email to answer {{name}} directly.</p>`),
  },
  {
    code: 'ENQUIRY_THANK_YOU',
    name: 'Thank you (sent to the enquirer)',
    description: 'Acknowledgement sent to the person who submitted the website contact form.',
    subject: 'Thank you for contacting {{companyName}}',
    variables: [
      { key: 'name', description: "Sender's name", sample: 'Rahul Sharma' },
      { key: 'service', description: 'Service the sender is interested in', sample: 'Shipping Agent' },
      { key: 'message', description: "Copy of the sender's message", sample: 'We need port agency support for a vessel arriving at Kandla next week.' },
      { key: 'phone', description: 'Company phone number', sample: '+91 98252 95685' },
      { key: 'supportEmail', description: 'Company contact email', sample: 'info@adityaco.co.in' },
      ...common,
    ],
    html: wrap(`<h2 style="margin:0 0 16px;font-size:22px;color:#0a0f1c;">Thank you, {{name}}</h2>
<p style="margin:0 0 16px;">We have received your enquiry about <strong>{{service}}</strong> and a member of our team will get back to you shortly.</p>
<p style="margin:0 0 8px;font-size:14px;color:#64748b;">Your message</p>
<div style="white-space:pre-wrap;background:#f5f7fb;border-radius:6px;padding:14px;margin:0 0 20px;font-size:15px;">{{message}}</div>
<p style="margin:0 0 4px;">If it is urgent, call us on <strong>{{phone}}</strong> or write to <a href="mailto:{{supportEmail}}" style="color:#3f5fe0;">{{supportEmail}}</a>.</p>
<p style="margin:16px 0 0;">Regards,<br>Team {{companyName}}</p>`),
  },
];

export const findDefault = (code: string) => DEFAULT_TEMPLATES.find((t) => t.code === code);
