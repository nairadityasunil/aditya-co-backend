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
  seedAdmin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

export default config;
