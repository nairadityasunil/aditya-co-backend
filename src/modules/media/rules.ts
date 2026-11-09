import config from '../../config/env';

export type MediaKind = 'image' | 'video';

export const VIDEO_FORMATS = ['mp4', 'mov', 'webm', 'm4v'];
export const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];

export const VIDEO_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-m4v': 'm4v',
};
export const IMAGE_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

export const MIN_CHUNK_BYTES = 5 * 1024 * 1024;
/** Recommended chunk size for large (video) uploads. Cloudinary requires >= 5MB per chunk except the last. */
export const VIDEO_CHUNK_BYTES = 6 * 1024 * 1024;

export const rulesFor = (kind: MediaKind) =>
  kind === 'video'
    ? {
        kind,
        formats: VIDEO_FORMATS,
        mime: Object.keys(VIDEO_MIME),
        maxBytes: config.media.videoMaxBytes,
        maxSeconds: config.media.videoMaxSeconds,
        chunkBytes: VIDEO_CHUNK_BYTES,
      }
    : {
        kind,
        formats: IMAGE_FORMATS,
        mime: Object.keys(IMAGE_MIME),
        maxBytes: config.media.imageMaxBytes,
        maxSeconds: null,
        chunkBytes: null,
      };

export const extensionOf = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
};

export const mb = (bytes: number): string => `${Math.round((bytes / 1024 / 1024) * 10) / 10}MB`;
