import mongoose, { Schema } from 'mongoose';

const enquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '' },
    service: { type: String, default: '' },
    message: { type: String, required: true },
    /** Where the enquiry was sent from */
    source: { type: String, enum: ['contact-form', 'chatbot'], default: 'contact-form' },
    status: { type: String, enum: ['new', 'read', 'replied'], default: 'new', index: true },
    /** Whether the notification email to the company went out */
    emailStatus: { type: String, enum: ['sent', 'failed', 'skipped'], default: 'skipped' },
    emailError: { type: String, default: '' },
    /** The firm's replies, sent by email from the CMS. The visitor's own message is `message` above. */
    replies: {
      type: [
        new Schema(
          {
            message: { type: String, required: true },
            subject: { type: String, default: '' },
            sentBy: { type: String, default: '' },
            sentAt: { type: Date, default: Date.now },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model('Enquiry', enquirySchema);
