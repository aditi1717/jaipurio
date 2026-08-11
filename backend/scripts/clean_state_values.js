// Rewrites free-text state values to their canonical names across every place
// state is stored, merging buckets that were split by spelling or by a district
// name being entered instead of a state.
//
//   node scripts/clean_state_values.js            # dry run, writes nothing
//   node scripts/clean_state_values.js --apply    # writes, after backing up
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeState, isCanonicalState } from '../utils/indianStates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const BACKUP_PATH = path.join(__dirname, '..', `state-clean-backup-${Date.now()}.jsonl`);

// Unrecognised values become Unknown rather than staying as junk, so the
// analytics stop showing "nbwjkengw" as if it were a place.
const resolve = (value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return 'Unknown';
    if (isCanonicalState(raw)) return canonicalizeState(raw);
    return canonicalizeState(raw) || 'Unknown';
};

const run = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    const db = mongoose.connection.db;
    const backup = APPLY ? fs.createWriteStream(BACKUP_PATH, { flags: 'a' }) : null;
    const record = (entry) => backup?.write(`${JSON.stringify(entry)}\n`);

    const summary = {};
    const note = (scope, from, to) => {
        if (from === to) return;
        summary[scope] = summary[scope] || {};
        const label = `${from} -> ${to}`;
        summary[scope][label] = (summary[scope][label] || 0) + 1;
    };

    // --- products.viewStatsByState: entries must be merged, not just renamed,
    // because two spellings of one state become two entries for it.
    let productsTouched = 0;
    const productCursor = db.collection('products')
        .find({ 'viewStatsByState.0': { $exists: true } }, { projection: { viewStatsByState: 1 } });

    for await (const product of productCursor) {
        const merged = new Map();
        let changed = false;

        for (const entry of product.viewStatsByState || []) {
            const to = resolve(entry?.state);
            if (to !== String(entry?.state ?? '').trim()) changed = true;
            note('products', String(entry?.state ?? ''), to);
            merged.set(to, (merged.get(to) || 0) + (Number(entry?.count) || 0));
        }

        if (!changed && merged.size === (product.viewStatsByState || []).length) continue;

        productsTouched += 1;
        if (APPLY) {
            record({ collection: 'products', id: String(product._id), before: product.viewStatsByState });
            await db.collection('products').updateOne(
                { _id: product._id },
                { $set: { viewStatsByState: [...merged].map(([state, count]) => ({ state, count })) } }
            );
        }
    }

    // --- simple string fields elsewhere
    const simpleTargets = [
        { collection: 'orders', field: 'shippingAddress.state' },
        { collection: 'portalsessions', field: 'state' }
    ];

    const touched = { orders: 0, portalsessions: 0, users: 0 };

    for (const { collection, field } of simpleTargets) {
        const cursor = db.collection(collection).find(
            { [field]: { $exists: true, $ne: '' } },
            { projection: { [field]: 1 } }
        );

        for await (const doc of cursor) {
            const current = field.split('.').reduce((value, part) => value?.[part], doc);
            if (current === undefined || current === null) continue;
            const to = resolve(current);
            if (to === String(current).trim()) continue;

            note(collection, String(current), to);
            touched[collection] += 1;
            if (APPLY) {
                record({ collection, id: String(doc._id), field, before: current });
                await db.collection(collection).updateOne({ _id: doc._id }, { $set: { [field]: to } });
            }
        }
    }

    // --- users.addresses is an array, so each element is rewritten in place
    const userCursor = db.collection('users')
        .find({ 'addresses.0': { $exists: true } }, { projection: { addresses: 1 } });

    for await (const user of userCursor) {
        let changed = false;
        const addresses = (user.addresses || []).map((address) => {
            const current = String(address?.state ?? '').trim();
            if (!current) return address;
            const to = resolve(current);
            if (to === current) return address;
            note('users', current, to);
            changed = true;
            return { ...address, state: to };
        });

        if (!changed) continue;
        touched.users += 1;
        if (APPLY) {
            record({ collection: 'users', id: String(user._id), before: user.addresses });
            await db.collection('users').updateOne({ _id: user._id }, { $set: { addresses } });
        }
    }

    if (backup) await new Promise((resolve2) => backup.end(resolve2));

    console.log(`mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN'}\n`);
    for (const [scope, changes] of Object.entries(summary)) {
        console.log(`--- ${scope} ---`);
        Object.entries(changes)
            .sort((a, b) => b[1] - a[1])
            .forEach(([label, count]) => console.log(`  ${String(count).padStart(5)}  ${label}`));
    }

    console.log('\ndocuments to change:');
    console.log(`  products       : ${productsTouched}`);
    console.log(`  orders         : ${touched.orders}`);
    console.log(`  portalsessions : ${touched.portalsessions}`);
    console.log(`  users          : ${touched.users}`);
    if (APPLY) console.log(`\nbackup: ${BACKUP_PATH}`);
    else console.log('\nNothing was written. Re-run with --apply to commit.');

    await mongoose.disconnect();
};

run().catch((error) => {
    console.error('State cleanup failed:', error);
    process.exit(1);
});
