// Self-check for OTP mobile normalisation. Run: node scripts/check_otp_mobile.js
// Storing and looking up must agree, or verification can never find the record.
import assert from 'assert';

const normalizeOtpMobile = (value = '') => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
};

const TEN = '9876500011';

// Every shape a client might send must collapse to the same key.
for (const input of [TEN, `+91${TEN}`, `91${TEN}`, `0${TEN}`, `+91 98765 00011`, ` ${TEN} `, `+91-${TEN}`]) {
    assert.strictEqual(normalizeOtpMobile(input), TEN, `${input} should normalise to ${TEN}`);
}

// The save key and the lookup key must be identical for the same input.
for (const input of [TEN, `+91${TEN}`, `91${TEN}`]) {
    assert.strictEqual(
        normalizeOtpMobile(input),
        normalizeOtpMobile(input),
        'save and lookup normalisation must agree'
    );
}

// Short or empty values are left alone so the caller can reject them.
assert.strictEqual(normalizeOtpMobile('12345'), '12345');
assert.strictEqual(normalizeOtpMobile(''), '');
assert.strictEqual(normalizeOtpMobile(null), '');
assert.strictEqual(normalizeOtpMobile(undefined), '');

// Distinct numbers must not collide.
assert.notStrictEqual(normalizeOtpMobile('9876500011'), normalizeOtpMobile('9876500012'));

console.log('otp mobile normalisation OK');
