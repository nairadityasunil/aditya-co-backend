import mongoose from 'mongoose';
import https from 'https';
import config from './env';
import logger from '../utils/logger';

async function resolveSrvFallback(uri: string): Promise<string> {
  const cleanUri = uri.trim();
  if (!cleanUri.startsWith('mongodb+srv://')) {
    return uri;
  }

  let addressPart = cleanUri.slice('mongodb+srv://'.length);
  const queryIdx = addressPart.indexOf('?');
  if (queryIdx !== -1) addressPart = addressPart.substring(0, queryIdx);
  const pathIdx = addressPart.indexOf('/');
  if (pathIdx !== -1) addressPart = addressPart.substring(0, pathIdx);
  const atIdx = addressPart.lastIndexOf('@');
  const authPart = atIdx !== -1 ? addressPart.substring(0, atIdx) : '';
  const srvHost = atIdx !== -1 ? addressPart.substring(atIdx + 1) : addressPart;

  const restOfUri = cleanUri.slice(cleanUri.indexOf(srvHost) + srvHost.length);

  return new Promise((resolve, reject) => {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(`_mongodb._tcp.${srvHost}`)}&type=SRV`;
    https
      .get(url, (res) => {
        let d = '';
        res.on('data', (chunk) => (d += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            if (!json.Answer || !Array.isArray(json.Answer) || json.Answer.length === 0) {
              return reject(new Error(`No DoH SRV records found for _mongodb._tcp.${srvHost}`));
            }
            const hosts = json.Answer.map((a: { data: string }) => {
              const parts = a.data.trim().split(/\s+/);
              return parts[3].replace(/\.$/, '') + ':' + (parts[2] || '27017');
            }).join(',');

            const authPrefix = authPart ? authPart + '@' : '';
            const separator = restOfUri.includes('?') ? '&' : '?';
            const resolvedUri = `mongodb://${authPrefix}${hosts}${restOfUri}${separator}ssl=true`;
            resolve(resolvedUri);
          } catch (e: any) {
            reject(e);
          }
        });
      })
      .on('error', (err) => reject(err));
  });
}

const connectDB = async (): Promise<void> => {
  logger.info('MongoDB connecting...');

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err: Error) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  try {
    await mongoose.connect(config.mongodbUri);
    logger.info('MongoDB connected successfully');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('querySrv') || errorMsg.includes('ECONNREFUSED')) {
      logger.warn('Native DNS querySrv failed. Attempting fallback SRV resolution via DoH...');
      try {
        const fallbackUri = await resolveSrvFallback(config.mongodbUri);
        await mongoose.connect(fallbackUri);
        logger.info('MongoDB connected successfully (via SRV fallback)');
        return;
      } catch (fallbackErr: unknown) {
        const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        logger.error(`MongoDB SRV fallback error: ${fbMsg}`);
      }
    }
    logger.error(`MongoDB connection error: ${errorMsg}`);
    throw err;
  }
};

export default connectDB;
