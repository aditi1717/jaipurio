// Writes a .webp sibling next to every uploaded raster image, so nginx can
// serve WebP to browsers that accept it while the stored URL never changes.
//
//   node scripts/generate_webp.js            # convert everything missing
//   node scripts/generate_webp.js --stats    # report only, convert nothing
//
// Safe to re-run: an existing, newer .webp is skipped, so an interrupted run
// just resumes. Originals are never modified or deleted.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const STATS_ONLY = process.argv.includes('--stats');

const SOURCE_PATTERN = /\.(png|jpe?g)$/i;
const QUALITY = 82;
const MAX_DIMENSION = 1600;
// This box has ~2GB RAM shared with the API, and sharp holds the decoded
// bitmap in memory: a 4000x4000 PNG is ~64MB before encoding.
const CONCURRENCY = 2;

sharp.cache(false);
sharp.concurrency(1);

const walk = (dir) => {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(full);
    }
    return out;
};

const needsConversion = (source, target) => {
    if (!fs.existsSync(target)) return true;
    // Regenerate if the original was replaced after the webp was written.
    return fs.statSync(source).mtimeMs > fs.statSync(target).mtimeMs;
};

const run = async () => {
    if (!fs.existsSync(UPLOADS_ROOT)) throw new Error(`uploads directory not found: ${UPLOADS_ROOT}`);

    const sources = walk(UPLOADS_ROOT).filter((file) => SOURCE_PATTERN.test(file));
    const pending = sources.filter((file) => needsConversion(file, `${file}.webp`));

    let originalBytes = 0;
    for (const file of sources) originalBytes += fs.statSync(file).size;

    console.log(`raster images : ${sources.length}`);
    console.log(`already done  : ${sources.length - pending.length}`);
    console.log(`to convert    : ${pending.length}`);
    console.log(`original size : ${(originalBytes / 1073741824).toFixed(2)} GB`);

    if (STATS_ONLY) return;
    if (!pending.length) {
        console.log('\nNothing to do.');
        return;
    }

    let done = 0;
    let failed = 0;
    let sourceBytes = 0;
    let webpBytes = 0;
    let index = 0;

    const worker = async () => {
        while (index < pending.length) {
            const source = pending[index];
            index += 1;
            const target = `${source}.webp`;
            const temp = `${target}.tmp`;

            try {
                // Cap absurd dimensions, but never upscale a small image.
                await sharp(source, { failOn: 'none' })
                    .rotate()
                    .resize({
                        width: MAX_DIMENSION,
                        height: MAX_DIMENSION,
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .webp({ quality: QUALITY, effort: 4 })
                    .toFile(temp);

                const produced = fs.statSync(temp).size;
                const original = fs.statSync(source).size;

                // A webp bigger than the original helps nobody; drop it and let
                // nginx fall back to the original file.
                if (produced >= original) {
                    fs.unlinkSync(temp);
                } else {
                    fs.renameSync(temp, target);
                    webpBytes += produced;
                    sourceBytes += original;
                }
                done += 1;
            } catch (error) {
                failed += 1;
                fs.existsSync(temp) && fs.unlinkSync(temp);
                if (failed <= 5) console.error(`  failed: ${path.basename(source)} — ${error.message}`);
            }

            if ((done + failed) % 500 === 0) {
                const saved = sourceBytes ? (1 - webpBytes / sourceBytes) * 100 : 0;
                console.log(`${done + failed}/${pending.length} | converted ${done} | failed ${failed} | saving ${saved.toFixed(0)}%`);
            }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const saved = sourceBytes ? (1 - webpBytes / sourceBytes) * 100 : 0;
    console.log('\n--- done ---');
    console.log(`converted : ${done}`);
    console.log(`failed    : ${failed}`);
    console.log(`source    : ${(sourceBytes / 1048576).toFixed(0)} MB`);
    console.log(`webp      : ${(webpBytes / 1048576).toFixed(0)} MB`);
    console.log(`saving    : ${saved.toFixed(1)}%`);
};

run().catch((error) => {
    console.error('WebP generation failed:', error);
    process.exit(1);
});
