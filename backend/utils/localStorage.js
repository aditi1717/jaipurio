import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

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
