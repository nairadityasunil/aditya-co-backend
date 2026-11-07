import { NextFunction, Request, Response, Router } from 'express';
import { Routes } from '../../interfaces/routes.interface';
import { Achievement, GalleryItem, Project, SoftwareService, Stat, TeamMember } from '../content/models';
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
        const [settings, stats, softwareServices, projects, achievements, gallery, team] = await Promise.all([
          getSettings(),
          Stat.find(q).sort(sort).lean(),
          SoftwareService.find(q).sort(sort).lean(),
          Project.find(q).sort(sort).lean(),
          Achievement.find(q).sort(sort).lean(),
          GalleryItem.find(q).sort(sort).lean(),
          TeamMember.find(q).sort(sort).lean(),
        ]);
        res.set('Cache-Control', 'public, max-age=60');
        res.status(200).json({ data: { settings, stats, softwareServices, projects, achievements, gallery, team } });
      } catch (e) {
        next(e);
      }
    });
  }
}

export default PublicRoutes;
