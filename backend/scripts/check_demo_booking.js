// Self-check for demo booking input handling. Run: node scripts/check_demo_booking.js
// Pure-function checks only — no DB connection needed.
import assert from 'assert';

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const normalizePincode = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 6);
const normalizePhone = (value) => String(value ?? '').replace(/\D/g, '').slice(-10);

// --- pincode normalisation ---
assert.strictEqual(normalizePincode('751024'), '751024');
assert.strictEqual(normalizePincode(' 751 024 '), '751024');
assert.strictEqual(normalizePincode('751024xyz'), '751024');
// Too short must stay short so the caller rejects it.
assert.strictEqual(normalizePincode('7510'), '7510');
assert.strictEqual(normalizePincode(''), '');
assert.strictEqual(normalizePincode(null), '');

// --- phone normalisation: keep the last 10 digits, so +91 prefixes work ---
assert.strictEqual(normalizePhone('9876543210'), '9876543210');
assert.strictEqual(normalizePhone('+91 98765 43210'), '9876543210');
assert.strictEqual(normalizePhone('091-9876543210'), '9876543210');
assert.strictEqual(normalizePhone('12345'), '12345');

// --- text cleaning is bounded so a huge body cannot bloat a document ---
assert.strictEqual(clean('  Ravi Kumar  ', 120), 'Ravi Kumar');
assert.strictEqual(clean('x'.repeat(5000), 500).length, 500);
assert.strictEqual(clean(undefined), '');

// --- slot whitelist ---
const BOOKABLE_SLOTS = ['morning', 'afternoon', 'evening', 'any'];
const resolveSlot = (value) =>
    BOOKABLE_SLOTS.includes(String(value || '').toLowerCase())
        ? String(value).toLowerCase()
        : 'any';
assert.strictEqual(resolveSlot('Morning'), 'morning');
assert.strictEqual(resolveSlot('whenever'), 'any');
assert.strictEqual(resolveSlot(undefined), 'any');

// --- the serviceability gate must require BOTH active and demoEnabled ---
const isBookable = (pin) => Boolean(pin && pin.isActive && pin.demoEnabled);
assert.strictEqual(isBookable({ isActive: true, demoEnabled: true }), true);
assert.strictEqual(isBookable({ isActive: true, demoEnabled: false }), false, 'deliverable-only pincode must not be bookable');
assert.strictEqual(isBookable({ isActive: false, demoEnabled: true }), false, 'inactive pincode must not be bookable');
assert.strictEqual(isBookable(null), false);

console.log('demo booking input handling OK');
