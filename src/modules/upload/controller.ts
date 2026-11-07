import { Request, Response, NextFunction } from 'express';
import { deleteFromCloudinary } from '../../utils/cloudinary';
import logger from '../../utils/logger';

class UploadController {
  public uploadSingle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      // multer-storage-cloudinary attaches path (Cloudinary URL) and filename (public_id)
      const file = req.file as Express.Multer.File & { path: string; filename: string };

      logger.info(`File uploaded successfully to Cloudinary: ${file.path}`);

      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          url: file.path,
          public_id: file.filename,
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  public uploadMultiple = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        res.status(400).json({ success: false, error: 'No files uploaded' });
        return;
      }

      const files = req.files as Array<Express.Multer.File & { path: string; filename: string }>;

      const uploadedFiles = files.map((file) => ({
        url: file.path,
        public_id: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      }));

      logger.info(`${uploadedFiles.length} files uploaded successfully to Cloudinary`);

      res.status(200).json({
        success: true,
        message: 'Files uploaded successfully',
        data: uploadedFiles,
      });
    } catch (error) {
      next(error);
    }
  };

  public deleteMedia = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const publicId = (req.body.public_id || req.query.public_id) as string;

      if (!publicId) {
        res.status(400).json({ success: false, error: 'public_id parameter is required' });
        return;
      }

      const resourceType = (req.body.resource_type || req.query.resource_type || 'image') as 'image' | 'raw' | 'video';
      let deleted = await deleteFromCloudinary(publicId, resourceType);

      if (!deleted && resourceType === 'image') {
        deleted = await deleteFromCloudinary(publicId, 'raw');
      }

      if (deleted) {
        res.status(200).json({
          success: true,
          message: 'Media deleted successfully from Cloudinary',
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to delete media from Cloudinary or media not found',
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

export default new UploadController();
