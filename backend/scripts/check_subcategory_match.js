// Self-check for the subcategory name fallback regex.
// Run: node scripts/check_subcategory_match.js
import assert from 'assert';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameMatcher = (term) =>
    new RegExp(`(^|[^A-Za-z0-9])${escapeRegex(term)}([^A-Za-z0-9]|$)`, 'i');

const matches = (term, name) => nameMatcher(term).test(name);

// The bug: "mi" used to match these via an unanchored substring.
assert.strictEqual(matches('mi', 'Reno16  5G  AI Remix Collage'), false, 'must not match inside "Remix"');
assert.strictEqual(matches('mi', 'Reno15 Pro Mini 5G'), false, 'must not match inside "Mini"');
assert.strictEqual(matches('mi', 'Xiaomi 14 Ultra'), false, 'must not match inside "Xiaomi"');

// Genuine matches still work.
assert.strictEqual(matches('mi', 'Mi 11 Lite'), true);
assert.strictEqual(matches('mi', 'MI 11 LITE'), true, 'case-insensitive');
assert.strictEqual(matches('redmi', 'REDMI Note 13 5G'), true);
assert.strictEqual(matches('redmi', 'redmi A7 Pro 5G'), true);
assert.strictEqual(matches('oppo', 'OPPO Reno15 Pro Mini 5G'), true);

// "redmi" must not be dragged into the "mi" listing either.
assert.strictEqual(matches('mi', 'REDMI Note 12 Pro 5G'), false, '"mi" must not match "REDMI"');

// Regex metacharacters in a subcategory name stay literal.
assert.strictEqual(matches('c+', 'Galaxy C+ Edition'), true);
assert.strictEqual(matches('c+', 'Galaxy CCC Edition'), false);

console.log('subcategory name matching OK');
