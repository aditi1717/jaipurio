// Read-only scan: finds every Cloudinary URL in every collection.
// Writes a manifest used by cloudinary_download.js and cloudinary_remap.js.
// Run: node scripts/cloudinary_inventory.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CLOUDINARY_RE = /https?:\/\/res\.cloudinary\.com\/[^\s"'<>)\\]+/g;
export const MANIFEST_PATH = path.join(__dirname, '..', 'cloudinary-manifest.json');

// Walks any nested shape and reports [dotted.path, url] for each Cloudinary URL.
const findUrls = (value, trail = []) => {
    const found = [];

    if (typeof value === 'string') {
        const matches = value.match(CLOUDINARY_RE);
        if (matches) {
            for (const url of matches) found.push({ field: trail.join('.'), url });
        }
        return found;
    }

    if (Array.isArray(value)) {
        value.forEach((entry, index) => found.push(...findUrls(entry, [...trail, index])));
        return found;
    }

    if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof mongoose.Types.ObjectId)) {
        for (const [key, nested] of Object.entries(value)) {
            if (key === '_id') continue;
            found.push(...findUrls(nested, [...trail, key]));
        }
    }

    return found;
};

const run = async () => {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set');
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();
    const entries = [];
    const urlSet = new Set();
    const perCollection = {};

    for (const { name } of collections) {
        const cursor = db.collection(name).find({}, { readPreference: 'primary' });
        let hits = 0;

        for await (const doc of cursor) {
            for (const { field, url } of findUrls(doc)) {
                entries.push({ collection: name, id: String(doc._id), field, url });
                urlSet.add(url);
                hits += 1;
            }
        }

        if (hits) perCollection[name] = hits;
    }

    const manifest = {
        generatedAt: new Date().toISOString(),
        totalReferences: entries.length,
        uniqueUrls: urlSet.size,
        perCollection,
        urls: [...urlSet].sort(),
        entries
    };

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

    console.log('--- Cloudinary inventory ---');
    for (const [name, count] of Object.entries(perCollection).sort((a, b) => b[1] - a[1])) {
        console.log(`${String(count).padStart(6)}  ${name}`);
    }
    console.log(`\ntotal references : ${entries.length}`);
    console.log(`unique files     : ${urlSet.size}`);
    console.log(`manifest         : ${MANIFEST_PATH}`);

    await mongoose.disconnect();
};

run().catch((error) => {
    console.error('Inventory failed:', error);
    process.exit(1);
});
