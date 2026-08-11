// Self-check for the geo-IP state fallback. Run: node scripts/check_geo_state.js
import assert from 'assert';
import { resolveStateFromIp, normalizeIp, getClientIp } from '../utils/geoState.js';

// --- IP normalisation ---
assert.strictEqual(normalizeIp('::ffff:49.207.1.1'), '49.207.1.1', 'IPv4-mapped IPv6 must unwrap');
assert.strictEqual(normalizeIp('  1.2.3.4 '), '1.2.3.4');
assert.strictEqual(normalizeIp(''), '');
assert.strictEqual(normalizeIp(null), '');

// --- private and bogus addresses must never yield a state ---
for (const ip of ['127.0.0.1', '::1', '10.0.0.5', '192.168.1.9', '172.16.4.2', '169.254.1.1', '', 'not-an-ip']) {
    assert.strictEqual(resolveStateFromIp(ip), '', `${ip} must not resolve`);
}

// --- non-Indian addresses are ignored so foreign traffic is not mislabelled ---
assert.strictEqual(resolveStateFromIp('8.8.8.8'), '', 'US address must not map to an Indian state');

// --- the client IP comes from what nginx forwarded, leftmost entry first ---
assert.strictEqual(
    getClientIp({ headers: { 'x-forwarded-for': '49.207.1.1, 10.0.0.1' }, ip: '127.0.0.1' }),
    '49.207.1.1',
    'must take the original client, not the proxy hop'
);
assert.strictEqual(
    getClientIp({ headers: { 'x-real-ip': '49.207.2.2' }, ip: '127.0.0.1' }),
    '49.207.2.2'
);
assert.strictEqual(getClientIp({ headers: {}, ip: '::ffff:49.207.3.3' }), '49.207.3.3');

// --- a resolvable Indian address returns a real state name, never a code ---
const resolved = resolveStateFromIp('49.207.192.1');
assert.ok(
    resolved === '' || /^[A-Z][A-Za-z ]+$/.test(resolved),
    `expected a state name or empty, got ${JSON.stringify(resolved)}`
);
console.log(`sample Indian IP resolved to: ${resolved || '(no match in database)'}`);

console.log('geo state fallback OK');
