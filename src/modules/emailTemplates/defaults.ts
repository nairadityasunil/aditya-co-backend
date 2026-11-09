/**
 * Default email templates, written to the database on first use or `npm run seed`.
 * After that the CMS copy is the source of truth; "Reset to default" restores these.
 * Variables use {{name}} and are HTML-escaped when rendered.
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

const wrap = (title: string, inner: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0a0f1c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#0a0f1c;padding:20px 28px;">
          <span style="font-size:18px;font-weight:bold;color:#ffffff;">{{companyName}}</span>
          <span style="display:block;height:3px;width:40px;background:#f12024;margin-top:10px;"></span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${title}</h1>
${inner}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          {{companyName}} &middot; Gandhidham, Gujarat, India
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const label = 'padding:8px 0;width:110px;vertical-align:top;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;';
const box = 'padding:16px;background:#f5f7fb;border-radius:12px;font-size:15px;line-height:1.6;white-space:pre-wrap;';

const common: TemplateVariable[] = [
  { key: 'companyName', description: 'Company name', sample: 'Aditya & Co.' },
  { key: 'websiteUrl', description: 'Public website address', sample: 'https://adityaco.co.in' },
];
const enquiry: TemplateVariable[] = [
  { key: 'name', description: "Visitor's full name", sample: 'Rahul Sharma' },
  { key: 'firstName', description: "Visitor's first name", sample: 'Rahul' },
  { key: 'email', description: "Visitor's email address", sample: 'rahul@example.com' },
  { key: 'phone', description: "Visitor's phone, or 'Not provided'", sample: '+91 98765 43210' },
  { key: 'service', description: 'Service the visitor asked about', sample: 'Shipping Agent' },
  { key: 'via', description: 'Where it came from: contact form or chatbot', sample: 'contact form' },
  { key: 'message', description: "The visitor's message", sample: 'We need port agency support for a vessel arriving at Kandla next week.' },
];

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    code: 'ENQUIRY_NOTIFICATION',
    name: 'New enquiry (sent to the company)',
    description: 'Emailed to the company when someone submits the contact form or the chatbot. Pressing Reply answers the visitor directly.',
    subject: 'New enquiry: {{service}} from {{name}}',
    variables: [...enquiry, ...common],
    html: wrap(
      'New enquiry',
      `          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="${label}">Name</td><td style="padding:8px 0;font-size:15px;">{{name}}</td></tr>
            <tr><td style="${label}">Email</td><td style="padding:8px 0;font-size:15px;"><a href="mailto:{{email}}" style="color:#3f5fe0;">{{email}}</a></td></tr>
            <tr><td style="${label}">Phone</td><td style="padding:8px 0;font-size:15px;">{{phone}}</td></tr>
            <tr><td style="${label}">Service</td><td style="padding:8px 0;font-size:15px;">{{service}}</td></tr>
            <tr><td style="${label}">Via</td><td style="padding:8px 0;font-size:15px;">{{via}}</td></tr>
          </table>
          <div style="margin-top:16px;${box}">{{message}}</div>
          <p style="margin:20px 0 0;font-size:13px;color:#64748b;">Press Reply to answer {{name}} directly. It is also saved in the CMS under Enquiries.</p>`
    ),
  },
  {
    code: 'ENQUIRY_THANK_YOU',
    name: 'Thank you (sent to the visitor)',
    description: 'Acknowledgement emailed to the visitor right after they send an enquiry.',
    subject: 'We received your enquiry | {{companyName}}',
    variables: [...enquiry, ...common],
    html: wrap(
      'Thank you, {{firstName}}',
      `          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">We have received your enquiry about <strong>{{service}}</strong> and our team will get back to you shortly.</p>
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Your message</p>
          <div style="${box}">{{message}}</div>
          <p style="margin:20px 0 0;font-size:13px;color:#64748b;">If it is urgent, you can also call or message us on WhatsApp. Please do not reply with sensitive information.</p>`
    ),
  },
  {
    code: 'ENQUIRY_REPLY',
    name: 'Reply to a visitor (sent from the CMS)',
    description: 'Wraps the answer you type under Enquiries in the CMS. The visitor sees their original message below it.',
    subject: 'Re: your enquiry about {{service}} | {{companyName}}',
    variables: [
      { key: 'reply', description: 'The reply you wrote in the CMS', sample: 'Thanks for getting in touch. We can handle this port call; could you share the ETA?' },
      { key: 'sentBy', description: 'Name of the team member replying', sample: 'Sunil Nair' },
      ...enquiry,
      ...common,
    ],
    html: wrap(
      'Hello {{firstName}}',
      `          <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;">{{reply}}</div>
          <p style="margin:22px 0 0;font-size:15px;">Regards,<br><strong>{{sentBy}}</strong><br><span style="color:#64748b;">{{companyName}}</span></p>
          <p style="margin:26px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Your enquiry about {{service}}</p>
          <div style="padding:14px;background:#f5f7fb;border-left:3px solid #cbd5e1;border-radius:8px;font-size:14px;line-height:1.6;color:#475569;white-space:pre-wrap;">{{message}}</div>
          <p style="margin:18px 0 0;font-size:13px;color:#64748b;">Just reply to this email to continue the conversation.</p>`
    ),
  },
  {
    code: 'TEST_EMAIL',
    name: 'Test email (CMS "Send test email")',
    description: 'Sent by the Send test email button on the Enquiries page to check that mail works.',
    subject: 'Test email from the {{companyName}} CMS',
    variables: common,
    html: wrap(
      'Email is working',
      `          <p style="margin:0;font-size:15px;line-height:1.6;">This is a test message from the {{companyName}} CMS. New enquiries will be emailed to this address.</p>`
    ),
  },
];

export const findDefault = (code: string) => DEFAULT_TEMPLATES.find((t) => t.code === code);
