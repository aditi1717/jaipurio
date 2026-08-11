// Self-check for state canonicalisation. Run: node scripts/check_indian_states.js
import assert from 'assert';
import { canonicalizeState, isCanonicalState, ALL_INDIAN_STATES } from '../utils/indianStates.js';

// 28 states + 8 union territories
assert.strictEqual(ALL_INDIAN_STATES.length, 36, 'expected 36 states and union territories');

// Canonical names pass straight through, whatever the casing or spacing.
assert.strictEqual(canonicalizeState('Odisha'), 'Odisha');
assert.strictEqual(canonicalizeState('odisha'), 'Odisha');
assert.strictEqual(canonicalizeState('  ODISHA  '), 'Odisha');
// The real reason several rows read as unrecognised: a stray double space.
assert.strictEqual(canonicalizeState('Madhya  Pradesh'), 'Madhya Pradesh');
assert.strictEqual(canonicalizeState('Tamil  Nadu'), 'Tamil Nadu');

// Misspellings observed in this database.
for (const variant of ['Orissa', 'ORISSA', 'orissa', 'Odisa', 'Odhisha', 'Odish']) {
    assert.strictEqual(canonicalizeState(variant), 'Odisha', `${variant} should map to Odisha`);
}
assert.strictEqual(canonicalizeState('Tamilnadu'), 'Tamil Nadu');
assert.strictEqual(canonicalizeState('Andhrapradesh'), 'Andhra Pradesh');
assert.strictEqual(canonicalizeState('Gujrat'), 'Gujarat');
assert.strictEqual(canonicalizeState('Telengana'), 'Telangana');

// Districts and towns entered instead of a state.
for (const place of ['Dhenkanal', 'Sundargarh', 'Sundar Garh', 'Bhadrak', 'Cuttack', 'Koraput', 'Bubonaswer']) {
    assert.strictEqual(canonicalizeState(place), 'Odisha', `${place} should map to Odisha`);
}
assert.strictEqual(canonicalizeState('Shimla'), 'Himachal Pradesh');
assert.strictEqual(canonicalizeState('Hyderabad telangana'), 'Telangana');

// Unambiguous abbreviations resolve; ambiguous ones must not.
assert.strictEqual(canonicalizeState('UP'), 'Uttar Pradesh');
assert.strictEqual(canonicalizeState('up'), 'Uttar Pradesh');
assert.strictEqual(canonicalizeState('MP'), 'Madhya Pradesh');
assert.strictEqual(canonicalizeState('WB'), 'West Bengal');
assert.strictEqual(canonicalizeState('AP'), '', '"AP" is ambiguous and must stay unresolved');

// Junk must NOT be guessed at — an empty result becomes Unknown upstream.
for (const junk of ['nbwjkengw', 'jijbweujigtbwtr', 'Jio office', 'India', '', '   ', null, undefined]) {
    assert.strictEqual(canonicalizeState(junk), '', `${JSON.stringify(junk)} must not resolve to a state`);
}

// isCanonicalState only accepts real names, not aliases.
assert.strictEqual(isCanonicalState('Odisha'), true);
assert.strictEqual(isCanonicalState('Orissa'), false);
assert.strictEqual(isCanonicalState('Dhenkanal'), false);

console.log('indian state canonicalisation OK');
