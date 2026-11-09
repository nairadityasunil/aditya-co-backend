import Joi from 'joi';
import slugify from 'slugify';
import { Routes } from '../../interfaces/routes.interface';
import { buildCrudRoutes } from './factory';
import { countryName } from '../analytics/classify';
import { Achievement, GalleryItem, Project, ServiceCountry, ShippingService, SoftwareService, Stat, TeamMember, Testimonial } from './models';

const flags = {
  displayOrder: Joi.number().integer().min(0),
  isPublished: Joi.boolean(),
};
const text = (max = 200) => Joi.string().trim().max(max);
/** Rich-text fields are stored as HTML, which is several times longer than the visible text. */
const rich = (max: number) => text(max * 5);
const url = Joi.string().trim().allow('').max(500);

const galleryVideo = Joi.object({
  publicId: Joi.string().trim().max(300).required(),
  url: Joi.string().trim().uri().max(600).required(),
  thumbnail: Joi.string().trim().allow('').max(600),
  duration: Joi.number().min(0).max(24 * 3600),
  bytes: Joi.number().integer().min(0),
  format: text(10).allow(''),
  width: Joi.number().integer().min(0),
  height: Joi.number().integer().min(0),
});
const galleryBase = { caption: text(200).allow(''), category: text(60), width: Joi.number().integer().min(0).max(20000), height: Joi.number().integer().min(0).max(20000), ...flags };
const galleryCreate = Joi.object({
  mediaType: Joi.string().valid('image', 'video').default('image'),
  image: Joi.string().trim().max(600).allow('').when('mediaType', { is: 'video', then: Joi.optional(), otherwise: Joi.string().required() }),
  video: Joi.when('mediaType', { is: 'video', then: galleryVideo.required(), otherwise: Joi.valid(null) }),
  ...galleryBase,
});
const galleryUpdate = Joi.object({
  mediaType: Joi.string().valid('image', 'video'),
  image: Joi.string().trim().max(600).allow(''),
  video: galleryVideo.allow(null),
  ...galleryBase,
});

export const contentRoutes = (): Routes[] => [
  buildCrudRoutes({
    path: 'stats',
    label: 'Stat',
    model: Stat,
    searchFields: ['label', 'value'],
    schema: Joi.object({ value: text(30).required(), label: text(120).required(), page: Joi.string().valid('all', 'home', 'software', 'about', 'achievements'), ...flags }),
  }),
  buildCrudRoutes({
    path: 'software-services',
    label: 'Software service',
    model: SoftwareService,
    searchFields: ['title', 'description'],
    schema: Joi.object({
      title: text(120).required(),
      description: rich(600).required(),
      icon: text(40),
      ...flags,
    }),
  }),
  buildCrudRoutes({
    path: 'projects',
    label: 'Project',
    model: Project,
    searchFields: ['name', 'category', 'description'],
    schema: Joi.object({
      name: text(140).required(),
      slug: text(160).lowercase().allow(''),
      category: text(60),
      description: rich(2000).required(),
      stack: Joi.array().items(text(60)).max(60),
      status: text(80),
      url,
      image: url,
      featured: Joi.boolean(),
      bannerImage: url,
      summary: rich(4000).allow(''),
      categoryTags: Joi.array().items(text(60)).max(12),
      headline: text(200).allow(''),
      quote: rich(600).allow(''),
      githubUrl: url,
      engagementModel: text(160).allow(''),
      engagementLength: text(160).allow(''),
      marketStage: text(160).allow(''),
      teamMembers: text(300).allow(''),
      servicesProvided: text(400).allow(''),
      caseStudy: Joi.object({
        overview: rich(6000).allow(''),
        detailedDescription: rich(6000).allow(''),
        problemStatement: rich(6000).allow(''),
        proposedSolution: rich(6000).allow(''),
        intendedPurpose: Joi.array().items(text(400)).max(20),
        userBenefits: rich(6000).allow(''),
        adminBenefits: rich(6000).allow(''),
        executionSequence: Joi.array().items(text(600)).max(20),
        technicalArchitecture: rich(6000).allow(''),
        implementationDetails: rich(6000).allow(''),
        challengesSolved: rich(6000).allow(''),
        outcome: rich(6000).allow(''),
        futureScope: Joi.array().items(text(400)).max(20),
        maintenanceSupport: rich(6000).allow(''),
        customSections: Joi.array()
          .items(Joi.object({ title: text(140).required(), type: Joi.string().valid('paragraph', 'list'), content: rich(6000).allow('') }))
          .max(12),
      }),
      features: Joi.array().items(text(400)).max(24),
      results: Joi.array().items(Joi.object({ title: text(60).required(), text: text(160).allow('') })).max(8),
      gallery: Joi.array().items(Joi.string().trim().max(500)).max(12),
      ...flags,
    }),
    prepare: (data, isCreate) => {
      if (isCreate) data.slug = slugify(data.slug || data.name, { lower: true, strict: true });
      else if (data.slug) data.slug = slugify(data.slug, { lower: true, strict: true });
      return data;
    },
  }),
  buildCrudRoutes({
    path: 'achievements',
    label: 'Achievement',
    model: Achievement,
    searchFields: ['title', 'description'],
    schema: Joi.object({ title: text(140).required(), description: rich(600).required(), year: text(10).allow(''), ...flags }),
  }),
  buildCrudRoutes({
    path: 'gallery',
    label: 'Gallery item',
    model: GalleryItem,
    searchFields: ['caption', 'category'],
    schema: galleryCreate,
    updateSchema: galleryUpdate,
    facetField: 'category',
    prepare: (data) => {
      // A video item's poster is derived from the video thumbnail when none is given.
      if (data.mediaType === 'video' && data.video && !data.image) data.image = data.video.thumbnail || '';
      return data;
    },
  }),
  buildCrudRoutes({
    path: 'service-countries',
    label: 'Country',
    model: ServiceCountry,
    searchFields: ['name', 'code', 'ports'],
    schema: Joi.object({
      code: Joi.string().trim().uppercase().pattern(/^[A-Z]{2}$/).required(),
      ports: text(200).allow(''),
      note: text(300).allow(''),
      isOrigin: Joi.boolean(),
      ...flags,
    }),
    // the English country name is derived from the ISO code
    prepare: (data) => (data.code ? { ...data, name: countryName(String(data.code)) } : data),
  }),
  buildCrudRoutes({
    path: 'team',
    label: 'Team member',
    model: TeamMember,
    searchFields: ['name', 'role', 'key'],
    schema: Joi.object({
      key: text(30).lowercase().required(),
      name: text(100).required(),
      role: text(100).required(),
      image: url,
      bio: Joi.array().items(text(1200)).max(10),
      phone: text(40).allow(''),
      email: Joi.string().trim().email().max(160).allow(''),
      linkedinUrl: url,
      ideology: Joi.object({
        heading: text(200).allow(''),
        statement: rich(1200).allow(''),
        principles: Joi.array().items(Joi.object({ title: text(100).required(), text: text(300).allow('') })).max(6),
      }),
      ...flags,
    }),
  }),
  buildCrudRoutes({
    path: 'shipping-services',
    label: 'Shipping service',
    model: ShippingService,
    searchFields: ['title', 'slug', 'description'],
    schema: Joi.object({
      slug: text(80).lowercase().allow(''),
      title: text(120).required(),
      description: rich(600).required(),
      icon: text(40),
      heading: text(200).allow(''),
      image: url,
      paragraph1: rich(2000).allow(''),
      paragraph2: rich(2000).allow(''),
      reasons: Joi.array().items(Joi.object({ title: text(120).required(), text: text(400).allow('') })).max(10),
      ...flags,
    }),
    prepare: (data, isCreate) => {
      if (isCreate) data.slug = slugify(data.slug || data.title, { lower: true, strict: true });
      else if (data.slug) data.slug = slugify(data.slug, { lower: true, strict: true });
      return data;
    },
  }),
  buildCrudRoutes({
    path: 'testimonials',
    label: 'Testimonial',
    model: Testimonial,
    searchFields: ['name', 'company', 'quote'],
    schema: Joi.object({
      quote: rich(800).required(),
      name: text(100).required(),
      role: text(120).allow(''),
      company: text(120).allow(''),
      logo: url,
      image: url,
      ...flags,
    }),
  }),
];
