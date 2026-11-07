import { Router } from 'express';
import { Routes } from '../../interfaces/routes.interface';
import UploadController from './controller';
import { upload } from '../../middleware/upload.middleware';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware';

class UploadRoutes implements Routes {
  public path = '/api';
  public router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Single file upload
    this.router.post(
      `${this.path}/admin/upload/single`,
      requireAuth,
      requireAdmin,
      upload.single('file'),
      UploadController.uploadSingle
    );

    // Multiple file upload
    this.router.post(
      `${this.path}/admin/upload/multiple`,
      requireAuth,
      requireAdmin,
      upload.array('files', 10),
      UploadController.uploadMultiple
    );

    // Delete media by public_id
    this.router.delete(
      `${this.path}/admin/upload`,
      requireAuth,
      requireAdmin,
      UploadController.deleteMedia
    );
  }
}

export default UploadRoutes;
