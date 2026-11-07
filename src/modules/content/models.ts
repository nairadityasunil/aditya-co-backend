import mongoose, { Schema } from 'mongoose';

const common = {
  displayOrder: { type: Number, default: 0, index: true },
  isPublished: { type: Boolean, default: true, index: true },
};
const opts = { timestamps: true };

/** Home / About / Software / Achievements statistics strip */
export const Stat = mongoose.model(
  'Stat',
  new Schema({ value: { type: String, required: true, trim: true }, label: { type: String, required: true, trim: true }, ...common }, opts)
);

/** Software development service cards */
export const SoftwareService = mongoose.model(
  'SoftwareService',
  new Schema(
    {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true },
      icon: { type: String, default: 'Code' },
      ...common,
    },
    opts
  )
);

/** Software products developed and managed by the firm */
export const Project = mongoose.model(
  'Project',
  new Schema(
    {
      name: { type: String, required: true, trim: true },
      slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
      category: { type: String, default: 'Web Application', trim: true },
      description: { type: String, required: true },
      stack: { type: [String], default: [] },
      status: { type: String, default: 'Live', trim: true },
      url: { type: String, default: '' },
      image: { type: String, default: '' },
      featured: { type: Boolean, default: false },
      ...common,
    },
    opts
  )
);

export const Achievement = mongoose.model(
  'Achievement',
  new Schema(
    {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true },
      year: { type: String, default: '' },
      ...common,
    },
    opts
  )
);

export const GalleryItem = mongoose.model(
  'GalleryItem',
  new Schema(
    {
      image: { type: String, required: true },
      caption: { type: String, default: '' },
      category: { type: String, default: 'Operations', trim: true },
      ...common,
    },
    opts
  )
);

/** Leadership (founder & CEO, CTO). The CTO entry carries the ideology section. */
export const TeamMember = mongoose.model(
  'TeamMember',
  new Schema(
    {
      key: { type: String, required: true, unique: true, lowercase: true, trim: true }, // e.g. "founder", "cto"
      name: { type: String, required: true, trim: true },
      role: { type: String, required: true, trim: true },
      image: { type: String, default: '' },
      bio: { type: [String], default: [] },
      ideology: {
        heading: { type: String, default: '' },
        statement: { type: String, default: '' },
        principles: { type: [{ title: String, text: String, _id: false }], default: [] },
      },
      ...common,
    },
    opts
  )
);
