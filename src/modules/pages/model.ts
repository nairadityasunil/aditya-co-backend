import mongoose, { Schema } from 'mongoose';

/** Editable copy for one page/section of the website, keyed by page (home, about, footer, ...). */
const pageContentSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

export default mongoose.model('PageContent', pageContentSchema);
