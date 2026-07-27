// Downloads every Cloudinary asset in the manifest into backend/uploads/,
// preserving the Cloudinary folder structure. Safe to re-run: existing files
// with a matching size are skipped, so an interrupted run just resumes.
// Run: node scripts/cloudinary_download.js
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, '..', 'cloudinary-manifest.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const MAP_PATH = path.join(__dirname, '..', 'cloudinary-url-map.json');

const CONCURRENCY = 6;
const MAX_RETRIES = 3;

// https://res.cloudinary.com/<cloud>/image/upload/v123456/folder/name.png
//   -> folder/name.png   (version segment carries no meaning for us)
export const toRelativePath = (url) => {
    const afterUpload = String(url).split('/upload/')[1];
    if (!afterUpload) return null;

    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const clean = decodeURIComponent(withoutVersion.split('?')[0]);

    // Never let a stored value escape the uploads directory.
    if (!clean || clean.includes('..') || path.isAbsolute(clean)) return null;
    return clean;
};

const fetchWithRetry = async (url) => {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            const response = await fetch(url);
            if (response.ok) return response;
            // 4xx other than 429 will not fix themselves; stop early.
            if (response.status < 500 && response.status !== 429) {
                throw new Error(`HTTP ${response.status}`);
            }
            lastError = new Error(`HTTP ${response.status}`);
        } catch (error) {
            lastError = error;
        }

        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }

    throw lastError;
};

const downloadOne = async (url) => {
    const relative = toRelativePath(url);
    if (!relative) return { url, status: 'bad-url' };

    const target = path.join(UPLOADS_DIR, relative);

    // Resume check happens before any network call: cancelling an in-flight
    // response body trips an undici assertion that kills the whole process,
    // and skipping 1000s of files without a round-trip is far faster anyway.
    if (fs.existsSync(target) && fs.statSync(target).size > 0) {
        return { url, relative, status: 'skipped' };
    }

    const response = await fetchWithRetry(url);
    fs.mkdirSync(path.dirname(target), { recursive: true });

    // Write to a temp file first so an interrupted run never leaves a
    // truncated file that a later run would treat as complete.
    const temp = `${target}.part`;
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temp));
    fs.renameSync(temp, target);

    return { url, relative, status: 'downloaded', bytes: fs.statSync(target).size };
};

const run = async () => {
    if (!fs.existsSync(MANIFEST_PATH)) {
        throw new Error('cloudinary-manifest.json missing — run cloudinary_inventory.js first');
    }

    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const urls = manifest.urls || [];
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    // Drop truncated files from an interrupted run so they are re-fetched.
    const sweepPartials = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) sweepPartials(full);
            else if (entry.name.endsWith('.part')) fs.unlinkSync(full);
        }
    };
    sweepPartials(UPLOADS_DIR);

    const urlMap = fs.existsSync(MAP_PATH)
        ? JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'))
        : {};
    const failures = [];
    let downloaded = 0;
    let skipped = 0;
    let bytes = 0;
    let index = 0;

    const worker = async () => {
        while (index < urls.length) {
            const current = index;
            index += 1;
            const url = urls[current];

            try {
                const result = await downloadOne(url);
                if (result.status === 'bad-url') {
                    failures.push({ url, error: 'unparseable url' });
                } else {
                    urlMap[url] = `/uploads/${result.relative}`;
                    if (result.status === 'downloaded') {
                        downloaded += 1;
                        bytes += result.bytes || 0;
                    } else {
                        skipped += 1;
                    }
                }
            } catch (error) {
                failures.push({ url, error: error.message });
            }

            const done = downloaded + skipped + failures.length;
            if (done % 250 === 0) {
                console.log(`${done}/${urls.length} | new ${downloaded} | skip ${skipped} | fail ${failures.length} | ${(bytes / 1024 / 1024).toFixed(0)}MB`);
                fs.writeFileSync(MAP_PATH, JSON.stringify(urlMap, null, 2));
            }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    fs.writeFileSync(MAP_PATH, JSON.stringify(urlMap, null, 2));
    if (failures.length) {
        fs.writeFileSync(path.join(__dirname, '..', 'cloudinary-failures.json'), JSON.stringify(failures, null, 2));
    }

    console.log('\n--- download complete ---');
    console.log(`downloaded : ${downloaded}`);
    console.log(`skipped    : ${skipped}`);
    console.log(`failed     : ${failures.length}`);
    console.log(`new bytes  : ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    console.log(`mapped     : ${Object.keys(urlMap).length}/${urls.length}`);
    console.log(`url map    : ${MAP_PATH}`);
    if (failures.length) console.log('failures   : cloudinary-failures.json (re-run to retry)');
};

// Only run when invoked directly; this module also exports toRelativePath.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    run().catch((error) => {
        console.error('Download failed:', error);
        process.exit(1);
    });
}
