// Self-check for the return customer-name fallback.
// Run: node scripts/check_return_customer.js
import assert from 'assert';

const resolveCustomerName = (user, order) => {
    const candidates = [
        user?.name,
        order?.shippingAddress?.name,
        user?.phone,
        order?.shippingAddress?.phone,
        user?.email
    ];

    for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (value && !value.endsWith('@otp.local') && !value.endsWith('@temp.local')) return value;
    }

    return 'Customer';
};

const order = { shippingAddress: { name: 'Jagan Mohapatra', phone: '7894418606' } };

// A real account name wins.
assert.strictEqual(resolveCustomerName({ name: 'Asha Devi' }, order), 'Asha Devi');

// The actual production case: OTP account with a blank name.
assert.strictEqual(
    resolveCustomerName({ name: '', phone: '7894418606', email: '7894418606@otp.local' }, order),
    'Jagan Mohapatra',
    'must fall back to the shipping name rather than fail validation'
);

// Whitespace-only names are treated as blank.
assert.strictEqual(resolveCustomerName({ name: '   ' }, order), 'Jagan Mohapatra');
assert.strictEqual(resolveCustomerName({}, order), 'Jagan Mohapatra');
assert.strictEqual(resolveCustomerName(null, order), 'Jagan Mohapatra');

// No shipping name: phone is preferred over a placeholder email.
assert.strictEqual(
    resolveCustomerName({ name: '', phone: '9876543210', email: 'x@otp.local' }, { shippingAddress: {} }),
    '9876543210'
);

// Placeholder emails must never be used as a display name.
assert.strictEqual(resolveCustomerName({ email: 'x@otp.local' }, {}), 'Customer');
assert.strictEqual(resolveCustomerName({ email: 'x@temp.local' }, {}), 'Customer');

// A genuine email is acceptable when nothing better exists.
assert.strictEqual(resolveCustomerName({ email: 'real@gmail.com' }, {}), 'real@gmail.com');

// Never returns empty — the field is required by the schema.
for (const [user, ord] of [[null, null], [{}, {}], [{ name: '' }, { shippingAddress: {} }]]) {
    const result = resolveCustomerName(user, ord);
    assert.ok(result && result.trim().length > 0, 'must never resolve to an empty value');
}

console.log('return customer fallback OK');
