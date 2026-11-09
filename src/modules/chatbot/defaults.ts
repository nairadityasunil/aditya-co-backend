/**
 * Starting content for the website's guided assistant. Everything here can be edited under Chatbot in the CMS.
 *
 * Answers may use placeholders that the website fills in from the live CMS content, so they never go stale:
 * {shippingServices} {softwareServices} {products} (bullet lists), and {phone} {whatsapp} {email} {address}.
 */
export type TopicType = 'answer' | 'lead' | 'contact';

export interface Topic {
  id: string;
  label: string;
  /** answer: show the text. lead: start collecting an enquiry. contact: show the text plus call / WhatsApp / email buttons. */
  type: TopicType;
  answer: string;
  linkLabel: string;
  linkTo: string;
}

export const DEFAULT_GREETING = "Hi! I'm the Aditya & Co. assistant. How can I help you today?";

export const DEFAULT_TOPICS: Topic[] = [
  {
    id: 'shipping',
    label: 'Shipping & logistics services',
    type: 'answer',
    answer: 'We provide these shipping and logistics services:\n{shippingServices}',
    linkLabel: 'See all shipping services',
    linkTo: '/services',
  },
  {
    id: 'software',
    label: 'IT & software services',
    type: 'answer',
    answer: 'Our IT and software services:\n{softwareServices}',
    linkLabel: 'See IT & software services',
    linkTo: '/software',
  },
  {
    id: 'products',
    label: 'Our software products',
    type: 'answer',
    answer: 'Software products we have built and manage:\n{products}',
    linkLabel: 'View our products',
    linkTo: '/software#portfolio',
  },
  {
    id: 'quote',
    label: 'Get a quote / send an enquiry',
    type: 'lead',
    answer: '',
    linkLabel: '',
    linkTo: '',
  },
  {
    id: 'contact',
    label: 'Contact & office address',
    type: 'contact',
    answer: 'You can reach us here:\n- Phone: {phone}\n- WhatsApp: {whatsapp}\n- Email: {email}\n- Office: {address}',
    linkLabel: 'Open the contact page',
    linkTo: '/contact',
  },
];

export const DEFAULT_LEAD_INTRO = "Happy to help. I'll ask a few quick questions so our team can get back to you.";
export const DEFAULT_THANKS = 'Thank you! Your enquiry has been sent. Our team will get back to you shortly.';
