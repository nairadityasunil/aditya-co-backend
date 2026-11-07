import mongoose, { Schema } from 'mongoose';

const enquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    service: { type: String, default: '' },
    message: { type: String, required: true },
    status: { type: String, enum: ['new', 'read', 'replied'], default: 'new', index: true },
  },
  { timestamps: true }
);

export default mongoose.model('Enquiry', enquirySchema);
