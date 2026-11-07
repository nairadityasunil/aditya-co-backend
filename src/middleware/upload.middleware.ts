import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';
import config from '../config/env';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (_req, file) => {
    const folder = config.cloudinary.folder || 'aditya_co';
    const isIco = file.originalname.toLowerCase().endsWith('.ico');
    const isPdf = file.originalname.toLowerCase().endsWith('.pdf');

    const cleanFileName = file.originalname
      .split('.')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');

    if (isPdf) {
      return {
        folder: folder,
        resource_type: 'image',
        format: 'pdf',
        public_id: `${Date.now()}_${cleanFileName}`,
      };
    }

    return {
      folder: folder,
      resource_type: isIco ? 'raw' : 'auto',
      public_id: `${Date.now()}_${cleanFileName}${isIco ? '.ico' : ''}`,
    };
  },
});

export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB maximum file size
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/x-icon',
      'image/vnd.microsoft.icon',
      'image/ico',
      'image/icon',
      'application/pdf',
      'application/x-ico',
      'application/ico',
      'application/octet-stream',
    ];

    const isIcoFile = file.originalname.toLowerCase().endsWith('.ico');
    const isPdfFile = file.originalname.toLowerCase().endsWith('.pdf');
    const isImageFile = /\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(file.originalname);

    if (allowedMimeTypes.includes(file.mimetype) || isIcoFile || isPdfFile || isImageFile) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, GIF, SVG, ICO and PDF files are allowed.'));
    }
  },
});
