import { NextFunction, Request, Response, Router } from 'express';
import { Routes } from '../../interfaces/routes.interface';
import { Achievement, GalleryItem, Project, ServiceCountry, ShippingService, SoftwareService, Stat, TeamMember, Testimonial } from '../content/models';
import { getAllPages } from '../pages/routes';
import { getSettings } from '../settings/routes';

/** One request returns everything the public website needs. */
class PublicRoutes implements Routes {
  public path = '/api/public';
  public router = Router();

  constructor() {
    this.router.get(`${this.path}/site`, async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const q = { isPublished: true };
        const sort = { displayOrder: 1, createdAt: -1 } as const;
        const [settings, stats, softwareServices, projects, achievements, gallery, team, shippingServices, pages, testimonials, serviceCountries] = await Promise.all([
          getSettings(),
          Stat.find(q).sort(sort).lean(),
          SoftwareService.find(q).sort(sort).lean(),
          Project.find(q).sort(sort).lean(),
          Achievement.find(q).sort(sort).lean(),
          GalleryItem.find(q).sort(sort).limit(20).lean(), // the gallery page pages through /api/public/gallery
          TeamMember.find(q).sort(sort).lean(),
          ShippingService.find(q).sort(sort).lean(),
          getAllPages(),
          Testimonial.find(q).sort(sort).lean(),
          ServiceCountry.find(q).sort(sort).lean(),
        ]);
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ data: { settings, stats, softwareServices, projects, achievements, gallery, team, shippingServices, pages, testimonials, serviceCountries } });
      } catch (e) {
        next(e);
      }
    });
  }
}

export default PublicRoutes;
