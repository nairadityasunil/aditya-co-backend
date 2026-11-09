import mongoose, { Schema } from 'mongoose';

const common = {
  displayOrder: { type: Number, default: 0, index: true },
  isPublished: { type: Boolean, default: true, index: true },
};
const opts = { timestamps: true };

/** Home / About / Software / Achievements statistics strip */
export const Stat = mongoose.model(
  'Stat',
  new Schema(
    {
      value: { type: String, required: true, trim: true },
      label: { type: String, required: true, trim: true },
      // which page shows this stat: 'all' or one page
      page: { type: String, enum: ['all', 'home', 'software', 'about', 'achievements'], default: 'all', index: true },
      ...common,
    },
    opts
  )
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
      // Case study (mirrors the structure of the portfolio CMS)
      bannerImage: { type: String, default: '' },
      summary: { type: String, default: '' },
      categoryTags: { type: [String], default: [] },
      headline: { type: String, default: '' },
      quote: { type: String, default: '' },
      githubUrl: { type: String, default: '' },
      engagementModel: { type: String, default: '' },
      engagementLength: { type: String, default: '' },
      marketStage: { type: String, default: '' },
      teamMembers: { type: String, default: '' },
      servicesProvided: { type: String, default: '' },
      features: { type: [String], default: [] },
      results: { type: [{ title: String, text: String, _id: false }], default: [] },
      gallery: { type: [String], default: [] },
      caseStudy: {
        overview: { type: String, default: '' },
        detailedDescription: { type: String, default: '' },
        problemStatement: { type: String, default: '' },
        proposedSolution: { type: String, default: '' },
        intendedPurpose: { type: [String], default: [] },
        userBenefits: { type: String, default: '' },
        adminBenefits: { type: String, default: '' },
        executionSequence: { type: [String], default: [] },
        technicalArchitecture: { type: String, default: '' },
        implementationDetails: { type: String, default: '' },
        challengesSolved: { type: String, default: '' },
        outcome: { type: String, default: '' },
        futureScope: { type: [String], default: [] },
        maintenanceSupport: { type: String, default: '' },
        customSections: {
          type: [{ title: String, type: { type: String, enum: ['paragraph', 'list'], default: 'paragraph' }, content: String, _id: false }],
          default: [],
        },
      },
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
      mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
      /** Image URL, or the poster frame for video items. */
      image: {
        type: String,
        default: '',
        validate: {
          validator(this: { mediaType?: string; video?: { url?: string } }, v: string) {
            return this.mediaType === 'video' || !!v;
          },
          message: 'image is required for image items',
        },
      },
      video: {
        type: new Schema(
          {
            publicId: { type: String, required: true },
            url: { type: String, required: true },
            thumbnail: { type: String, default: '' },
            duration: { type: Number, default: 0 },
            bytes: { type: Number, default: 0 },
            format: { type: String, default: '' },
            width: { type: Number, default: 0 },
            height: { type: Number, default: 0 },
          },
          { _id: false }
        ),
        default: undefined,
      },
      /** Natural size of the photo (or the video frame), so the site can lay items out before they load. */
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      caption: { type: String, default: '' },
      category: { type: String, default: 'Operations', trim: true },
      ...common,
    },
    opts
  )
);

/** A country (and the ports/cities in it) where Aditya & Co. has provided services; drives the world map. */
export const ServiceCountry = mongoose.model(
  'ServiceCountry',
  new Schema(
    {
      code: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z]{2}$/ }, // ISO 3166-1 alpha-2
      name: { type: String, default: '', trim: true },
      ports: { type: String, default: '', trim: true },
      note: { type: String, default: '' },
      isOrigin: { type: Boolean, default: false }, // the home base the routes start from
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
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      linkedinUrl: { type: String, default: '' },
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

/** Shipping & logistics services (list, navbar, footer and each service detail page). */
export const ShippingService = mongoose.model(
  'ShippingService',
  new Schema(
    {
      slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true },
      icon: { type: String, default: 'Ship' },
      heading: { type: String, default: '', trim: true },
      image: { type: String, default: '' },
      paragraph1: { type: String, default: '' },
      paragraph2: { type: String, default: '' },
      reasons: { type: [{ title: String, text: String, _id: false }], default: [] },
      ...common,
    },
    opts
  )
);

/** Client testimonials shown on the home page. */
export const Testimonial = mongoose.model(
  'Testimonial',
  new Schema(
    {
      quote: { type: String, required: true },
      name: { type: String, required: true, trim: true },
      role: { type: String, default: '', trim: true },
      company: { type: String, default: '', trim: true },
      logo: { type: String, default: '' },
      image: { type: String, default: '' },
      ...common,
    },
    opts
  )
);
