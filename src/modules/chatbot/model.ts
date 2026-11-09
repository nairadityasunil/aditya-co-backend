import mongoose, { Schema } from 'mongoose';

const topicSchema = new Schema(
  {
    id: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['answer', 'lead', 'contact'], default: 'answer' },
    answer: { type: String, default: '' },
    linkLabel: { type: String, default: '' },
    linkTo: { type: String, default: '' },
  },
  { _id: false }
);

/** Singleton holding the website assistant's menu and wording, editable from the CMS. */
const chatbotSchema = new Schema(
  {
    key: { type: String, default: 'site', unique: true },
    enabled: { type: Boolean, default: true },
    name: { type: String, default: 'Aditya & Co. Assistant', trim: true },
    greeting: { type: String, default: '' },
    /** The main menu buttons. Unset means the built-in defaults. */
    topics: { type: [topicSchema], default: undefined },
    leadIntro: { type: String, default: '' },
    thanks: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('ChatbotConfig', chatbotSchema);
