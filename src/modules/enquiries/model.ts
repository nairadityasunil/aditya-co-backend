import mongoose, { Schema } from 'mongoose';

const enquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    service: { type: String, default: '' },
    message: { type: String, required: true },
    // Email outcome, so a failed send can be found and followed up in the CMS
    notified: { type: Boolean, default: false },
    acknowledged: { type: Boolean, default: false },
    mailError: { type: String, default: '' },
    status: { type: String, enum: ['new', 'read', 'replied'], default: 'new', index: true },
  },
  { timestamps: true }
);

export default mongoose.model('Enquiry', enquirySchema);
