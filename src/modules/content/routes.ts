import Joi from 'joi';
import slugify from 'slugify';
import { Routes } from '../../interfaces/routes.interface';
import { buildCrudRoutes } from './factory';
import { Achievement, GalleryItem, Project, SoftwareService, Stat, TeamMember } from './models';

const flags = {
  displayOrder: Joi.number().integer().min(0),
  isPublished: Joi.boolean(),
};
const text = (max = 200) => Joi.string().trim().max(max);
const url = Joi.string().trim().allow('').max(500);

export const contentRoutes = (): Routes[] => [
  buildCrudRoutes({
    path: 'stats',
    label: 'Stat',
    model: Stat,
    searchFields: ['label', 'value'],
    schema: Joi.object({ value: text(30).required(), label: text(120).required(), ...flags }),
  }),
  buildCrudRoutes({
    path: 'software-services',
    label: 'Software service',
    model: SoftwareService,
    searchFields: ['title', 'description'],
    schema: Joi.object({
      title: text(120).required(),
      description: text(600).required(),
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
      slug: text(160).lowercase(),
      category: text(60),
      description: text(2000).required(),
      stack: Joi.array().items(text(40)).max(30),
      status: text(80),
      url,
      image: url,
      featured: Joi.boolean(),
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
    schema: Joi.object({ title: text(140).required(), description: text(600).required(), year: text(10).allow(''), ...flags }),
  }),
  buildCrudRoutes({
    path: 'gallery',
    label: 'Gallery item',
    model: GalleryItem,
    searchFields: ['caption', 'category'],
    schema: Joi.object({ image: Joi.string().trim().max(500).required(), caption: text(200).allow(''), category: text(60), ...flags }),
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
      ideology: Joi.object({
        heading: text(200).allow(''),
        statement: text(1200).allow(''),
        principles: Joi.array().items(Joi.object({ title: text(100).required(), text: text(300).allow('') })).max(6),
      }),
      ...flags,
    }),
  }),
];
