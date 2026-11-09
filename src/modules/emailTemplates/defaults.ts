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

const wrap = (title: string, inner: string, preheader = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f7;font-family:Arial,Helvetica,sans-serif;color:#0a0f1c;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dfe5ef;">
        <tr><td align="center" style="background:#0a0f1c;padding:30px 28px 24px;">
          <img src="{{logoUrl}}" alt="{{companyName}}" width="110" style="display:block;margin:0 auto 14px;border:0;outline:none;height:auto;max-width:110px;">
          <span style="display:block;font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:#a9b6d3;">{{companyName}}</span>
        </td></tr>
        <tr><td style="height:4px;line-height:4px;font-size:0;background:#f12024;">&nbsp;</td></tr>
        <tr><td style="padding:34px 36px 30px;">
          <h1 style="margin:0 0 6px;font-size:24px;line-height:1.3;color:#0a0f1c;">${title}</h1>
${inner}
        </td></tr>
        <tr><td align="center" style="padding:22px 28px;background:#0f172a;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#ffffff;">{{companyName}}</p>
          <p style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#94a3b8;">Gandhidham, Gujarat, India &middot; Shipping, logistics &amp; software</p>
          <a href="{{websiteUrl}}" style="font-size:12px;color:#ff6b6e;text-decoration:none;">{{websiteUrl}}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;


const common: TemplateVariable[] = [
  { key: 'companyName', description: 'Company name', sample: 'Aditya & Co.' },
  { key: 'websiteUrl', description: 'Public website address', sample: 'https://adityaco.co.in' },
  { key: 'logoUrl', description: 'Company logo image (must be a public https address)', sample: 'https://res.cloudinary.com/drd6hssz1/image/upload/f_png,w_240/v1775758145/aditya_logo_i0lvpo.png' },
  { key: 'adminUrl', description: 'Link to Enquiries in the CMS', sample: 'https://adityaco.co.in/admin/enquiries' },
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
      'New enquiry from {{name}}',
      `          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#475569;">Someone just got in touch through the <strong style="color:#0a0f1c;">{{via}}</strong> about <strong style="color:#0a0f1c;">{{service}}</strong>.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
            <tr><td style="padding:14px 18px;width:96px;vertical-align:middle;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Name</td><td style="padding:14px 18px 14px 0;font-size:15px;font-weight:bold;color:#0a0f1c;border-bottom:1px solid #e2e8f0;">{{name}}</td></tr>
            <tr><td style="padding:14px 18px;vertical-align:middle;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Email</td><td style="padding:14px 18px 14px 0;font-size:15px;border-bottom:1px solid #e2e8f0;"><a href="mailto:{{email}}" style="color:#3f5fe0;text-decoration:none;">{{email}}</a></td></tr>
            <tr><td style="padding:14px 18px;vertical-align:middle;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;">Phone</td><td style="padding:14px 18px 14px 0;font-size:15px;color:#0a0f1c;border-bottom:1px solid #e2e8f0;">{{phone}}</td></tr>
            <tr><td style="padding:14px 18px;vertical-align:middle;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;">Service</td><td style="padding:14px 18px 14px 0;font-size:15px;color:#0a0f1c;">{{service}}</td></tr>
          </table>

          <p style="margin:26px 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;">Their message</p>
          <div style="padding:18px 20px;background:#fff7f7;border-left:4px solid #f12024;border-radius:0 12px 12px 0;font-size:15px;line-height:1.7;color:#0a0f1c;white-space:pre-wrap;">{{message}}</div>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
            <tr>
              <td style="border-radius:10px;background:#f12024;"><a href="mailto:{{email}}?subject=Re%3A%20your%20enquiry" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">Reply to {{name}}</a></td>
              <td style="width:12px;">&nbsp;</td>
              <td style="border-radius:10px;border:1px solid #cbd5e1;"><a href="{{adminUrl}}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:bold;color:#0a0f1c;text-decoration:none;border-radius:10px;">Open in CMS</a></td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b;">You can also just press Reply on this email to answer {{name}} directly. It is saved in the CMS under Enquiries.</p>`,
      'New enquiry from {{name}} about {{service}}'
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
      `          <p style="margin:0 0 22px;font-size:16px;line-height:1.65;color:#475569;">We have received your enquiry about <strong style="color:#0a0f1c;">{{service}}</strong>. Our team is on it and will get back to you shortly.</p>

          <p style="margin:0 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;">Your message</p>
          <div style="padding:16px 18px;background:#fff7f7;border-left:4px solid #f12024;border-radius:0 12px 12px 0;font-size:15px;line-height:1.7;color:#0a0f1c;white-space:pre-wrap;">{{message}}</div>

          <p style="margin:30px 0 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;">What happens next</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:34px;vertical-align:top;padding:0 0 14px;"><div style="width:26px;height:26px;line-height:26px;text-align:center;border-radius:13px;background:#0a0f1c;color:#ffffff;font-size:13px;font-weight:bold;">1</div></td>
              <td style="padding:2px 0 14px;font-size:14px;line-height:1.55;color:#0a0f1c;"><strong>We review your enquiry</strong><br><span style="color:#64748b;">The right person on our team picks it up.</span></td>
            </tr>
            <tr>
              <td style="width:34px;vertical-align:top;padding:0 0 14px;"><div style="width:26px;height:26px;line-height:26px;text-align:center;border-radius:13px;background:#0a0f1c;color:#ffffff;font-size:13px;font-weight:bold;">2</div></td>
              <td style="padding:2px 0 14px;font-size:14px;line-height:1.55;color:#0a0f1c;"><strong>We get in touch with you</strong><br><span style="color:#64748b;">By email, or by phone if you shared a number.</span></td>
            </tr>
            <tr>
              <td style="width:34px;vertical-align:top;padding:0;"><div style="width:26px;height:26px;line-height:26px;text-align:center;border-radius:13px;background:#0a0f1c;color:#ffffff;font-size:13px;font-weight:bold;">3</div></td>
              <td style="padding:2px 0 0;font-size:14px;line-height:1.55;color:#0a0f1c;"><strong>We agree the next steps together</strong><br><span style="color:#64748b;">A clear plan and quote for what you need.</span></td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
            <tr><td style="padding:18px 20px;font-size:14px;line-height:1.8;color:#0a0f1c;">
              <strong>In a hurry? Reach us directly.</strong><br>
              Call <a href="tel:+919825295685" style="color:#d91b22;text-decoration:none;font-weight:bold;">+91 98252 95685</a>
              or WhatsApp <a href="https://wa.me/919427395685" style="color:#d91b22;text-decoration:none;font-weight:bold;">+91 94273 95685</a><br>
              Email <a href="mailto:info@adityaco.co.in" style="color:#d91b22;text-decoration:none;font-weight:bold;">info@adityaco.co.in</a>
              or <a href="mailto:adityakdl@gmail.com" style="color:#d91b22;text-decoration:none;font-weight:bold;">adityakdl@gmail.com</a>
            </td></tr>
          </table>
          <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">Please do not reply with sensitive information such as bank or card details.</p>`,
      'We have received your enquiry about {{service}}'
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
      `          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">Thank you for getting in touch. Here is our reply to your enquiry about <strong style="color:#0a0f1c;">{{service}}</strong>.</p>

          <div style="padding:20px 22px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;font-size:16px;line-height:1.75;color:#0a0f1c;white-space:pre-wrap;">{{reply}}</div>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0;">
            <tr>
              <td style="width:4px;background:#f12024;border-radius:2px;">&nbsp;</td>
              <td style="padding:2px 0 2px 14px;font-size:15px;line-height:1.6;color:#0a0f1c;">Regards,<br><strong>{{sentBy}}</strong><br><span style="color:#64748b;">{{companyName}}</span></td>
            </tr>
          </table>

          <p style="margin:30px 0 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;">Your original enquiry</p>
          <div style="padding:14px 16px;background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #cbd5e1;border-radius:0 10px 10px 0;font-size:14px;line-height:1.65;color:#475569;white-space:pre-wrap;">{{message}}</div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;background:#fff7f7;border:1px solid #fde1e1;border-radius:12px;">
            <tr><td style="padding:16px 20px;font-size:14px;line-height:1.7;color:#0a0f1c;">
              <strong>Questions? We are happy to help.</strong><br>
              Reply to this email, or write to us at
              <a href="mailto:info@adityaco.co.in" style="color:#d91b22;text-decoration:none;font-weight:bold;">info@adityaco.co.in</a>
              or
              <a href="mailto:adityakdl@gmail.com" style="color:#d91b22;text-decoration:none;font-weight:bold;">adityakdl@gmail.com</a>.
            </td></tr>
          </table>`,
      'Our reply to your enquiry about {{service}}'
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
