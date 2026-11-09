import mongoose, { Schema } from 'mongoose';

const schema = new Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    subject: { type: String, required: true, trim: true },
    html: { type: String, required: true },
    variables: {
      type: [{ key: String, description: String, sample: String, _id: false }],
      default: [],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('EmailTemplate', schema);
