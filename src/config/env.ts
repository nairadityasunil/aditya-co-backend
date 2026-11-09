import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Remove accidental surrounding quotes/whitespace
const rawMongoUri = (process.env.MONGODB_URI || '').trim().replace(/^["']|["']$/g, '');

if (!rawMongoUri.startsWith('mongodb://') && !rawMongoUri.startsWith('mongodb+srv://')) {
  throw new Error('Invalid MONGODB_URI: must start with "mongodb://" or "mongodb+srv://"');
}

if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET as string).length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri: rawMongoUri,
  jwt: {
    secret: process.env.JWT_SECRET as string,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    frontendBaseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:5173',
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(','),
  },
  // Cloudinary credentials are read from the environment only (no defaults in code).
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'aditya_co',
  },
  // Email for enquiries (Nodemailer). See services/mailer.service.ts for the Render free-plan notes.
  mail: {
    brevoApiKey: process.env.BREVO_API_KEY || '',
    smtp: {
      /** A Nodemailer "well-known service" such as gmail, as a shortcut for host, port and TLS */
      service: process.env.SMTP_SERVICE || '',
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT || 587),
      // port 465 is always TLS from the first byte; Nodemailer hangs if that flag is forgotten
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : Number(process.env.SMTP_PORT || 587) === 465,
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    from: process.env.MAIL_FROM || '',
    to: (process.env.MAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean),
  },
  // The production website whose analytics the CMS shows by default.
  analytics: {
    siteHost: (process.env.ANALYTICS_SITE_HOST || 'adityaco.co.in').replace(/^www\./, ''),
  },
  // Upload limits enforced by the media module (sign + finalize steps).
  media: {
    imageMaxBytes: Number(process.env.MEDIA_IMAGE_MAX_MB || 10) * 1024 * 1024,
    videoMaxBytes: Number(process.env.MEDIA_VIDEO_MAX_MB || 100) * 1024 * 1024,
    videoMaxSeconds: Number(process.env.MEDIA_VIDEO_MAX_SECONDS || 180),
  },
  seedAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

export default config;
