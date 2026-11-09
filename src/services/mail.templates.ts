/** Email wording and layout for enquiries. Plain inline-styled HTML, which every mail client renders. */

export interface EnquiryMail {
  name: string;
  email: string;
  phone?: string;
  service?: string;
  message: string;
  source?: string;
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nl2br = (s: string): string => esc(s).replace(/\r?\n/g, '<br>');

const shell = (title: string, body: string): string => `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#0a0f1c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#0a0f1c;padding:20px 28px;">
          <span style="font-size:18px;font-weight:bold;color:#ffffff;">Aditya &amp; Co.</span>
          <span style="display:block;height:3px;width:40px;background:#f12024;margin-top:10px;"></span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;">${esc(title)}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          Aditya &amp; Co. &middot; Gandhidham, Gujarat, India
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const row = (label: string, value: string): string =>
  `<tr><td style="padding:8px 0;width:110px;vertical-align:top;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">${esc(label)}</td><td style="padding:8px 0;font-size:15px;">${value}</td></tr>`;

/** To the company: a new enquiry arrived. Reply goes straight to the visitor. */
export function companyNotification(e: EnquiryMail): { subject: string; html: string; text: string } {
  const via = e.source === 'chatbot' ? 'chatbot' : 'contact form';
  const rows =
    row('Name', esc(e.name)) +
    row('Email', `<a href="mailto:${esc(e.email)}" style="color:#3f5fe0;">${esc(e.email)}</a>`) +
    (e.phone ? row('Phone', `<a href="tel:${esc(e.phone.replace(/\s/g, ''))}" style="color:#3f5fe0;">${esc(e.phone)}</a>`) : '') +
    row('Service', esc(e.service || 'General enquiry')) +
    row('Via', esc(via));
  const html = shell(
    'New enquiry',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
     <div style="margin-top:16px;padding:16px;background:#f5f7fb;border-radius:12px;font-size:15px;line-height:1.6;">${nl2br(e.message)}</div>
     <p style="margin:20px 0 0;font-size:13px;color:#64748b;">Press Reply to answer ${esc(e.name)} directly. It is also saved in the CMS under Enquiries.</p>`
  );
  const text = `New enquiry (${via})\n\nName: ${e.name}\nEmail: ${e.email}\n${e.phone ? `Phone: ${e.phone}\n` : ''}Service: ${e.service || 'General enquiry'}\n\n${e.message}\n\nReply to answer ${e.name} directly. Also saved in the CMS under Enquiries.`;
  // one line only: visitor-supplied text must never be able to add header lines
  return { subject: `New enquiry: ${e.service || 'General'} from ${e.name}`.replace(/\s+/g, ' ').slice(0, 200), html, text };
}

/** To the visitor: we received it. */
export function visitorConfirmation(e: EnquiryMail): { subject: string; html: string; text: string } {
  const first = e.name.trim().split(/\s+/)[0] || 'there';
  const html = shell(
    `Thank you, ${first}`,
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">We have received your enquiry${e.service ? ` about <strong>${esc(e.service)}</strong>` : ''} and our team will get back to you shortly.</p>
     <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Your message</p>
     <div style="padding:16px;background:#f5f7fb;border-radius:12px;font-size:15px;line-height:1.6;">${nl2br(e.message)}</div>
     <p style="margin:20px 0 0;font-size:13px;color:#64748b;">If it is urgent, you can also call or message us on WhatsApp. Please do not reply with sensitive information.</p>`
  );
  const text = `Thank you, ${first}\n\nWe have received your enquiry${e.service ? ` about ${e.service}` : ''} and our team will get back to you shortly.\n\nYour message:\n${e.message}\n\nAditya & Co., Gandhidham, Gujarat, India`;
  return { subject: 'We received your enquiry | Aditya & Co.', html, text };
}

/** The firm's reply to a visitor, written in the CMS. Their answer to it goes to the firm's own inbox. */
export function replyToVisitor(e: EnquiryMail, reply: string, sentBy?: string): { subject: string; html: string; text: string } {
  const first = e.name.trim().split(/\s+/)[0] || 'there';
  const html = shell(
    `Hello ${first}`,
    `<div style="font-size:15px;line-height:1.7;">${nl2br(reply)}</div>
     <p style="margin:22px 0 0;font-size:15px;">Regards,<br><strong>${esc(sentBy || 'Aditya & Co.')}</strong><br><span style="color:#64748b;">Aditya &amp; Co.</span></p>
     <p style="margin:26px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;">Your enquiry${e.service ? ` about ${esc(e.service)}` : ''}</p>
     <div style="padding:14px;background:#f5f7fb;border-left:3px solid #cbd5e1;border-radius:8px;font-size:14px;line-height:1.6;color:#475569;">${nl2br(e.message)}</div>
     <p style="margin:18px 0 0;font-size:13px;color:#64748b;">Just reply to this email to continue the conversation.</p>`
  );
  const text = `Hello ${first},

${reply}

Regards,
${sentBy || 'Aditya & Co.'}
Aditya & Co.

--- Your enquiry${e.service ? ` about ${e.service}` : ''} ---
${e.message}

Just reply to this email to continue the conversation.`;
  return { subject: `Re: your enquiry${e.service ? ` about ${e.service}` : ''} | Aditya & Co.`.replace(/\s+/g, ' ').slice(0, 200), html, text };
}

/** Sent from the CMS "Send test email" button. */
export function testEmail(): { subject: string; html: string; text: string } {
  const html = shell('Email is working', '<p style="margin:0;font-size:15px;line-height:1.6;">This is a test message from the Aditya &amp; Co. CMS. New enquiries will be emailed to this address.</p>');
  return { subject: 'Test email from the Aditya & Co. CMS', html, text: 'This is a test message from the Aditya & Co. CMS. New enquiries will be emailed to this address.' };
}
