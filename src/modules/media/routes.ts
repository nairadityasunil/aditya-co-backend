import { NextFunction, Request, Response, Router } from 'express';
import Joi from 'joi';
import cloudinary from '../../config/cloudinary';
import config from '../../config/env';
import { Routes } from '../../interfaces/routes.interface';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validation.middleware';
import { AppError, createNotFoundError, createValidationError } from '../../utils/app-error';
import logger from '../../utils/logger';
import { GalleryItem } from '../content/models';
import { IMAGE_MIME, MediaKind, VIDEO_MIME, extensionOf, mb, rulesFor } from './rules';

type ResourceType = 'image' | 'video' | 'raw';

const root = () => config.cloudinary.folder || 'aditya_co';
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Only assets inside the configured Cloudinary folder can be touched through this API. */
const assertInScope = (publicId: string) => {
  if (!publicId.startsWith(`${root()}/`) || publicId.includes('..')) {
    throw createValidationError(`publicId must be inside the "${root()}" folder`);
  }
};

/** A random moment between 8% and 92% of the video, avoiding the (often black) first and last frames. */
export const pickOffset = (duration: number): number => (duration > 1 ? Math.round((0.08 + Math.random() * 0.84) * duration * 10) / 10 : 0);

const thumbnailFor = (publicId: string, resourceType: ResourceType, secureUrl?: string, offset?: number): string | null => {
  if (resourceType === 'video') {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      secure: true,
      format: 'jpg',
      // library grid: Cloudinary's automatic frame; gallery posters: an explicit random frame, larger
      transformation: [{ start_offset: offset ?? 'auto', width: offset === undefined ? 640 : 960, crop: 'limit', quality: 'auto' }],
    });
  }
  if (resourceType === 'image') {
    return cloudinary.url(publicId, {
      resource_type: 'image',
      secure: true,
      transformation: [{ width: 320, height: 320, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
    }) || secureUrl || null;
  }
  return null;
};

const normalize = (r: any, randomFrame = false) => {
  const offset = randomFrame && r.resource_type === 'video' ? pickOffset(r.duration ?? 0) : undefined;
  return {
  publicId: r.public_id as string,
  resourceType: r.resource_type as ResourceType,
  format: r.format ?? null,
  url: r.secure_url as string,
  thumbnail: thumbnailFor(r.public_id, r.resource_type, r.secure_url, offset),
  thumbnailOffset: offset ?? null,
  bytes: r.bytes ?? 0,
  width: r.width ?? null,
  height: r.height ?? null,
  duration: r.duration ?? null,
  createdAt: r.created_at ?? null,
  };
};

const signSchema = Joi.object({
  resourceType: Joi.string().valid('image', 'video').required(),
  fileName: Joi.string().trim().max(200).required(),
  mimeType: Joi.string().trim().max(100).required(),
  size: Joi.number().integer().min(1).required(),
  subfolder: Joi.string().trim().lowercase().pattern(/^[a-z0-9_-]{1,40}$/).default('gallery'),
});

const finalizeSchema = Joi.object({
  publicId: Joi.string().trim().max(300).required(),
  resourceType: Joi.string().valid('image', 'video').required(),
});

const thumbnailSchema = Joi.object({ publicId: Joi.string().trim().max(300).required() });

const deleteSchema = Joi.object({
  items: Joi.array()
    .items(Joi.object({ publicId: Joi.string().trim().max(300).required(), resourceType: Joi.string().valid('image', 'video', 'raw').required() }))
    .min(1)
    .max(100)
    .required(),
  force: Joi.boolean().default(false),
});

/** Returns every validation problem for a file about to be uploaded. */
export function validateFileDescriptor(kind: MediaKind, fileName: string, mimeType: string, size: number): string[] {
  const rules = rulesFor(kind);
  const mimeMap = kind === 'video' ? VIDEO_MIME : IMAGE_MIME;
  const problems: string[] = [];
  const ext = extensionOf(fileName);
  if (!rules.formats.includes(ext)) problems.push(`Unsupported file extension ".${ext}". Allowed: ${rules.formats.join(', ')}`);
  if (!mimeMap[mimeType]) problems.push(`Unsupported file type "${mimeType}". Allowed: ${rules.mime.join(', ')}`);
  if (size > rules.maxBytes) problems.push(`File is ${mb(size)}; the ${kind} limit is ${mb(rules.maxBytes)}`);
  return problems;
}

class MediaRoutes implements Routes {
  public path = '/api/admin/media';
  public router = Router();

  constructor() {
    const guard = [requireAuth, requireAdmin];
    const r = this.router;

    // Limits the admin UI should validate against before uploading.
    r.get(`${this.path}/rules`, ...guard, (_req, res) => {
      res.status(200).json({ data: { image: rulesFor('image'), video: rulesFor('video') } });
    });

    // Cloudinary plan usage (storage, bandwidth, credits).
    r.get(`${this.path}/usage`, ...guard, async (_req, res, next) => {
      try {
        const u: any = await cloudinary.api.usage();
        res.status(200).json({ data: u });
      } catch (e) {
        next(this.wrap(e));
      }
    });

    // Library listing with search, type filter and cursor pagination.
    r.get(this.path, ...guard, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const type = typeof req.query.type === 'string' ? req.query.type : 'all';
        if (!['all', 'image', 'video', 'raw'].includes(type)) throw createValidationError('type must be all, image, video or raw');
        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 30, 1), 100);
        const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : undefined;
        const q = typeof req.query.search === 'string' ? req.query.search.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) : '';
        const sort = req.query.sort === 'oldest' ? 'asc' : 'desc';

        const parts = [q ? `public_id:${root()}/*${q}*` : `public_id:${root()}/*`];
        if (type !== 'all') parts.push(`resource_type:${type}`);

        let search = cloudinary.search.expression(parts.join(' AND ')).sort_by('created_at', sort).max_results(limit);
        if (cursor) search = search.next_cursor(cursor);
        const result: any = await search.execute();

        res.status(200).json({
          data: (result.resources ?? []).map(normalize),
          meta: { total: result.total_count ?? null, limit, nextCursor: result.next_cursor ?? null },
        });
      } catch (e) {
        next(this.wrap(e));
      }
    });

    // Single asset detail (publicId contains slashes, so it travels as a query param).
    r.get(`${this.path}/detail`, ...guard, async (req: Request, res: Response, next: NextFunction) => {
      try {
        const publicId = String(req.query.publicId ?? '');
        const resourceType = String(req.query.resourceType ?? 'image') as ResourceType;
        if (!publicId) throw createValidationError('publicId is required');
        if (!['image', 'video', 'raw'].includes(resourceType)) throw createValidationError('Invalid resourceType');
        assertInScope(publicId);
        const asset: any = await cloudinary.api.resource(publicId, { resource_type: resourceType }).catch((err: any) => {
          if (err?.http_code === 404) throw createNotFoundError('Media asset');
          throw err;
        });
        const usedBy = await this.findGalleryUsage([publicId]);
        res.status(200).json({ data: { ...normalize(asset), usedBy: usedBy.map((g) => ({ collection: 'gallery', id: String(g._id), caption: g.caption })) } });
      } catch (e) {
        next(this.wrap(e));
      }
    });

    // Step 1 of an upload: validate the file and hand back a short-lived signed payload.
    r.post(`${this.path}/sign`, ...guard, validateBody(signSchema), (req: Request, res: Response, next: NextFunction) => {
      try {
        const { resourceType, fileName, mimeType, size, subfolder } = req.body as {
          resourceType: MediaKind; fileName: string; mimeType: string; size: number; subfolder: string;
        };
        const problems = validateFileDescriptor(resourceType, fileName, mimeType, size);
        if (problems.length) throw new AppError(422, problems.join('. '), 'UPLOAD_REJECTED');

        const rules = rulesFor(resourceType);
        const clean = fileName.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'file';
        const timestamp = Math.round(Date.now() / 1000);
        const toSign = {
          allowed_formats: rules.formats.join(','),
          public_id: `${root()}/${subfolder}/${Date.now()}_${clean}`,
          timestamp,
        };
        const signature = cloudinary.utils.api_sign_request(toSign, config.cloudinary.apiSecret);

        res.status(200).json({
          data: {
            uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudinary.cloudName}/${resourceType}/upload`,
            apiKey: config.cloudinary.apiKey,
            signature,
            // Send these fields verbatim (plus api_key, signature, file) to uploadUrl.
            params: toSign,
            publicId: toSign.public_id,
            resourceType,
            chunkBytes: rules.chunkBytes,
            expiresAt: new Date((timestamp + 3600) * 1000).toISOString(),
          },
        });
      } catch (e) {
        next(e);
      }
    });

    // Step 2: verify what actually landed on Cloudinary; delete it if it breaks the rules.
    r.post(`${this.path}/finalize`, ...guard, validateBody(finalizeSchema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { publicId, resourceType } = req.body as { publicId: string; resourceType: MediaKind };
        assertInScope(publicId);
        const asset: any = await cloudinary.api.resource(publicId, { resource_type: resourceType }).catch((err: any) => {
          if (err?.http_code === 404) throw createNotFoundError('Uploaded asset');
          throw err;
        });

        const rules = rulesFor(resourceType);
        const problems: string[] = [];
        if (asset.bytes > rules.maxBytes) problems.push(`File is ${mb(asset.bytes)}; the ${resourceType} limit is ${mb(rules.maxBytes)}`);
        if (!rules.formats.includes(String(asset.format).toLowerCase())) problems.push(`Format "${asset.format}" is not allowed`);
        if (resourceType === 'video' && rules.maxSeconds && (asset.duration ?? 0) > rules.maxSeconds) {
          problems.push(`Video is ${Math.round(asset.duration)}s long; the limit is ${rules.maxSeconds}s`);
        }

        if (problems.length) {
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true }).catch((err: unknown) => {
            logger.error(`Failed to remove rejected upload ${publicId}`, err);
          });
          throw new AppError(422, problems.join('. '), 'UPLOAD_REJECTED');
        }
        res.status(200).json({ data: normalize(asset, true) });
      } catch (e) {
        next(this.wrap(e));
      }
    });

    // Pick another random frame as a video's thumbnail.
    r.post(`${this.path}/thumbnail`, ...guard, validateBody(thumbnailSchema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { publicId } = req.body as { publicId: string };
        assertInScope(publicId);
        const asset: any = await cloudinary.api.resource(publicId, { resource_type: 'video' }).catch((err: any) => {
          if (err?.http_code === 404) throw createNotFoundError('Video');
          throw err;
        });
        const offset = pickOffset(asset.duration ?? 0);
        res.status(200).json({ data: { thumbnail: thumbnailFor(publicId, 'video', asset.secure_url, offset), thumbnailOffset: offset } });
      } catch (e) {
        next(this.wrap(e));
      }
    });

    // Bulk delete. Refuses assets still used by gallery items unless force=true.
    r.delete(this.path, ...guard, validateBody(deleteSchema), async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { items, force } = req.body as { items: Array<{ publicId: string; resourceType: ResourceType }>; force: boolean };
        items.forEach((i) => assertInScope(i.publicId));

        if (!force) {
          const used = await this.findGalleryUsage(items.map((i) => i.publicId));
          if (used.length) {
            throw new AppError(409, `${used.length} gallery item(s) still use the selected media. Remove them first or pass force=true.`, 'MEDIA_IN_USE');
          }
        }

        const deleted: string[] = [];
        const failed: string[] = [];
        for (const type of ['image', 'video', 'raw'] as ResourceType[]) {
          const ids = items.filter((i) => i.resourceType === type).map((i) => i.publicId);
          if (!ids.length) continue;
          const result: any = await cloudinary.api.delete_resources(ids, { resource_type: type, type: 'upload', invalidate: true });
          for (const id of ids) (result.deleted?.[id] === 'deleted' ? deleted : failed).push(id);
        }
        res.status(200).json({ data: { deleted, failed } });
      } catch (e) {
        next(this.wrap(e));
      }
    });
  }

  private async findGalleryUsage(publicIds: string[]) {
    const regexes = publicIds.map((id) => new RegExp(escapeRegex(id)));
    return GalleryItem.find({ $or: [{ 'video.publicId': { $in: publicIds } }, { image: { $in: regexes } }, { 'video.url': { $in: regexes } }] })
      .select('caption')
      .lean();
  }

  /** Turns Cloudinary SDK errors into API errors, leaving AppErrors untouched. */
  private wrap(e: unknown): unknown {
    if (e instanceof AppError) return e;
    const err = e as { http_code?: number; message?: string; error?: { message?: string } };
    if (err?.http_code) {
      logger.error(`Cloudinary error: ${err.error?.message ?? err.message}`);
      return new AppError(err.http_code === 404 ? 404 : 502, err.error?.message ?? err.message ?? 'Cloudinary request failed', 'CLOUDINARY_ERROR');
    }
    return e;
  }
}

export default MediaRoutes;
