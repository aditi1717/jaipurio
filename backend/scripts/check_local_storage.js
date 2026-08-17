// Self-check for the local upload adapter. Run: node scripts/check_local_storage.js
import assert from 'assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { saveUploadedFile, UPLOADS_ROOT, toPublicUrl } from '../utils/localStorage.js';
import { toRelativePath } from './cloudinary_download.js';

process.env.ASSET_BASE_URL = 'https://backend.jaipurio.in';

// --- URL derivation used by the migration -------------------------------
assert.strictEqual(
    toRelativePath('https://res.cloudinary.com/dwq4xrqto/image/upload/v1775794725/ecom_uploads/products/abc.png'),
    'ecom_uploads/products/abc.png'
);
// Version segment is optional.
assert.strictEqual(
    toRelativePath('https://res.cloudinary.com/x/image/upload/ecom_uploads/banners/b.jpg'),
    'ecom_uploads/banners/b.jpg'
);
// Traversal attempts are rejected outright.
assert.strictEqual(toRelativePath('https://res.cloudinary.com/x/image/upload/v1/../../etc/passwd'), null);
assert.strictEqual(toRelativePath('https://example.com/not-cloudinary.png'), null);

// --- Upload adapter ------------------------------------------------------
const buffer = Buffer.from('fake-image-bytes');
const saved = await saveUploadedFile(
    { buffer, originalname: 'Photo Of A Thing.PNG' },
    { folder: 'ecom_uploads/products' }
);

assert.ok(saved.secure_url.startsWith('https://backend.jaipurio.in/uploads/ecom_uploads/products/'),
    `unexpected url: ${saved.secure_url}`);
assert.strictEqual(saved.format, 'png');
assert.strictEqual(saved.bytes, buffer.length);

const writtenPath = path.join(UPLOADS_ROOT, saved.secure_url.split('/uploads/')[1]);
assert.ok(fs.existsSync(writtenPath), 'file was not written to disk');
// The original filename must never determine the path on disk.
assert.ok(!writtenPath.includes(' '), 'filename was not sanitised');
fs.unlinkSync(writtenPath);

// A malicious folder must stay inside uploads/.
const escaped = await saveUploadedFile(
    { buffer, originalname: 'x.png' },
    { folder: '../../etc/cron.d' }
);
const escapedPath = path.join(UPLOADS_ROOT, escaped.secure_url.split('/uploads/')[1]);
assert.ok(
    path.resolve(escapedPath).startsWith(path.resolve(UPLOADS_ROOT)),
    `escaped uploads dir: ${escapedPath}`
);
fs.unlinkSync(escapedPath);

// A multer-style disk file is moved, not left behind.
const temp = path.join(os.tmpdir(), `ik-check-${Date.now()}.jpg`);
fs.writeFileSync(temp, buffer);
const moved = await saveUploadedFile({ path: temp, originalname: 'a.jpg' }, { folder: 'ecom_uploads/settings' });
assert.ok(!fs.existsSync(temp), 'temp upload was not cleaned up');
const movedPath = path.join(UPLOADS_ROOT, moved.secure_url.split('/uploads/')[1]);
assert.ok(fs.existsSync(movedPath));
fs.unlinkSync(movedPath);

assert.strictEqual(toPublicUrl('a/b.png'), 'https://backend.jaipurio.in/uploads/a/b.png');

console.log('local storage adapter OK');
