import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
export const UPLOADS_URL_PREFIX = '/uploads';

// Stored URLs must be absolute: the frontend runs on a different origin than
// the API, so a relative /uploads/... path would resolve against the storefront.
const getAssetBaseUrl = () =>
    String(process.env.ASSET_BASE_URL || 'https://backend.indiankart.in').replace(/\/+$/, '');

export const toPublicUrl = (relativePath) =>
    `${getAssetBaseUrl()}${UPLOADS_URL_PREFIX}/${String(relativePath).replace(/^\/+/, '')}`;

// Folder values come from our own call sites, but never let one escape uploads/.
const sanitizeFolder = (folder = '') => {
    const parts = String(folder || 'ecom_uploads')
        .split('/')
        .map((segment) => segment.trim().replace(/[^A-Za-z0-9._-]/g, ''))
        .filter((segment) => segment && segment !== '.' && segment !== '..');

    return parts.length ? parts.join('/') : 'ecom_uploads';
};

const sanitizeExtension = (name = '') => {
    const ext = path.extname(String(name || '')).toLowerCase();
    return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
};

const WEBP_SOURCE_PATTERN = /\.(png|jpe?g)$/i;

/**
 * Writes a .webp sibling next to a saved raster image. nginx serves it to
 * browsers that accept WebP while the stored URL stays pointing at the
 * original, so nothing downstream needs to know this happened.
 * Best-effort: a failure here must never fail the upload.
 */
const writeWebpSibling = async (target) => {
    if (!WEBP_SOURCE_PATTERN.test(target)) return;

    try {
        const webpPath = `${target}.webp`;
        await sharp(target, { failOn: 'none' })
            .rotate()
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 82, effort: 4 })
            .toFile(webpPath);

        // Keep it only when it actually beats the original.
        const [original, webp] = await Promise.all([fsp.stat(target), fsp.stat(webpPath)]);
        if (webp.size >= original.size) await fsp.unlink(webpPath).catch(() => {});
    } catch (error) {
        console.error(`WebP generation skipped for ${path.basename(target)}:`, error.message);
    }
};

/**
 * Persists an upload to local disk and returns a Cloudinary-shaped result, so
 * existing callers keep working unchanged.
 * Accepts a multer file (with .path or .buffer) or a raw Buffer.
 */
export const saveUploadedFile = async (input, options = {}) => {
    const folder = sanitizeFolder(options.folder);
    const extension = sanitizeExtension(input?.originalname) || sanitizeExtension(input?.path);
    const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const relativePath = `${folder}/${filename}`;
    const target = path.join(UPLOADS_ROOT, folder, filename);

    await fsp.mkdir(path.dirname(target), { recursive: true });

    if (input?.path) {
        // multer wrote it to a temp dir; move rather than copy where possible.
        try {
            await fsp.rename(input.path, target);
        } catch {
            await fsp.copyFile(input.path, target);
            await fsp.unlink(input.path).catch(() => {});
        }
    } else {
        const buffer = Buffer.isBuffer(input) ? input : input?.buffer;
        if (!buffer) throw new Error('Upload input must include a file path or buffer');
        await fsp.writeFile(target, buffer);
    }

    const { size } = await fsp.stat(target);
    await writeWebpSibling(target);

    return {
        secure_url: toPublicUrl(relativePath),
        url: toPublicUrl(relativePath),
        public_id: `${folder}/${path.basename(filename, extension)}`,
        format: extension.replace('.', ''),
        bytes: size,
        resource_type: options.resource_type === 'video' ? 'video' : 'image',
        storage: 'local'
    };
};

export const ensureUploadsDir = () => {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
    return UPLOADS_ROOT;
};
