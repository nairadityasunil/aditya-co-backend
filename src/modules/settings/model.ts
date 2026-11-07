import mongoose, { Schema } from 'mongoose';

/** Singleton document holding company-wide details shown in the footer, contact page and SEO. */
const settingsSchema = new Schema(
  {
    key: { type: String, default: 'site', unique: true },
    companyName: { type: String, default: 'Aditya & Co.' },
    tagline: { type: String, default: '' },
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    emails: { type: [String], default: [] },
    address: { type: String, default: '' },
    mapEmbedUrl: { type: String, default: '' },
    directionsUrl: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('SiteSettings', settingsSchema);
