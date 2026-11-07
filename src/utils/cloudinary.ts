import cloudinary from '../config/cloudinary';
import logger from './logger';

/**
 * Delete a file from Cloudinary by its public ID
 */
export async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    logger.info(`Cloudinary asset deletion result for ${publicId}:`, result);
    return result.result === 'ok';
  } catch (error) {
    logger.error(`Failed to delete asset ${publicId} from Cloudinary:`, error);
    return false;
  }
}

/**
 * Upload a Buffer directly to Cloudinary
 */
export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string = 'aditya_co',
  filename?: string
): Promise<{ url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename ? `${Date.now()}_${filename}` : undefined,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Cloudinary upload failed'));
        }
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
}
