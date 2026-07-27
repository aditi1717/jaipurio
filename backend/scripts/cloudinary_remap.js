// Rewrites every Cloudinary URL in the database to its locally hosted copy,
// using the map produced by cloudinary_download.js.
//
//   node scripts/cloudinary_remap.js            # dry run, writes nothing
//   node scripts/cloudinary_remap.js --apply    # writes, after backing up
//
// Only URLs whose file was actually downloaded are rewritten, so a partial
// download degrades to a partial remap rather than broken images.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPublicUrl } from '../utils/localStorage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MAP_PATH = path.join(__dirname, '..', 'cloudinary-url-map.json');
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const BACKUP_PATH = path.join(__dirname, '..', `remap-backup-${Date.now()}.jsonl`);
const APPLY = process.argv.includes('--apply');

// Replaces any mapped URL found inside a nested document shape.
const rewrite = (value, lookup, stats) => {
    if (typeof value === 'string') {
        const replacement = lookup.get(value);
        if (replacement) {
            stats.replaced += 1;
            return replacement;
        }
        if (value.includes('res.cloudinary.com')) stats.unmapped += 1;
        return value;
    }

    if (Array.isArray(value)) return value.map((entry) => rewrite(entry, lookup, stats));

    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
        const next = {};
        for (const [key, nested] of Object.entries(value)) {
            next[key] = key === '_id' ? nested : rewrite(nested, lookup, stats);
        }
        return next;
    }

    return value;
};

const run = async () => {
    if (!fs.existsSync(MAP_PATH)) throw new Error('cloudinary-url-map.json missing — run cloudinary_download.js first');

    const rawMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));

    // Trust the map only where the file is genuinely on disk.
    const lookup = new Map();
    let missingOnDisk = 0;
    for (const [cloudUrl, relative] of Object.entries(rawMap)) {
        const onDisk = path.join(UPLOADS_ROOT, relative.replace(/^\/uploads\//, ''));
        if (fs.existsSync(onDisk) && fs.statSync(onDisk).size > 0) {
            lookup.set(cloudUrl, toPublicUrl(relative.replace(/^\/uploads\//, '')));
        } else {
            missingOnDisk += 1;
        }
    }

    console.log(`mapped urls usable : ${lookup.size}`);
    console.log(`missing on disk    : ${missingOnDisk}`);
    console.log(`mode               : ${APPLY ? 'APPLY (writing)' : 'DRY RUN'}\n`);

    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    // Backups stream to newline-delimited JSON. Accumulating changed documents
    // in memory would risk an OOM on a small box: product docs carry large
    // dailyViewStats arrays and this host has under 2GB of RAM.
    const backupStream = APPLY ? fs.createWriteStream(BACKUP_PATH, { flags: 'a' }) : null;
    let backedUp = 0;

    const summary = {};
    let totalDocs = 0;
    let totalReplaced = 0;
    let totalUnmapped = 0;

    for (const { name } of collections) {
        const collection = db.collection(name);
        const cursor = collection.find({});
        let docsChanged = 0;
        let replacedHere = 0;

        for await (const doc of cursor) {
            const stats = { replaced: 0, unmapped: 0 };
            const updated = rewrite(doc, lookup, stats);
            totalUnmapped += stats.unmapped;

            if (!stats.replaced) continue;

            docsChanged += 1;
            replacedHere += stats.replaced;

            if (APPLY) {
                const line = `${JSON.stringify({ collection: name, id: String(doc._id), before: doc })}\n`;
                if (!backupStream.write(line)) {
                    await new Promise((resolve) => backupStream.once('drain', resolve));
                }
                backedUp += 1;

                // Only the fields that actually changed need writing back.
                const { _id, ...fields } = updated;
                await collection.updateOne({ _id: doc._id }, { $set: fields });
            }
        }

        if (docsChanged) {
            summary[name] = { docsChanged, replacedHere };
            totalDocs += docsChanged;
            totalReplaced += replacedHere;
        }
    }

    if (backupStream) {
        await new Promise((resolve) => backupStream.end(resolve));
    }

    console.log('--- remap summary ---');
    for (const [name, info] of Object.entries(summary)) {
        console.log(`${String(info.replacedHere).padStart(6)} urls in ${String(info.docsChanged).padStart(5)} docs  ${name}`);
    }
    console.log(`\ndocuments changed : ${totalDocs}`);
    console.log(`urls rewritten    : ${totalReplaced}`);
    console.log(`urls left as-is   : ${totalUnmapped} (not downloaded; still point at Cloudinary)`);
    if (APPLY) {
        console.log(`backup            : ${backedUp ? `${BACKUP_PATH} (${backedUp} docs)` : 'none needed'}`);
    } else {
        console.log('\nNothing was written. Re-run with --apply to commit.');
    }

    await mongoose.disconnect();
};

run().catch((error) => {
    console.error('Remap failed:', error);
    process.exit(1);
});
