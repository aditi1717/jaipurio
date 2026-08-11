import geoip from 'geoip-lite';

// geoip-lite returns ISO 3166-2 subdivision codes. Mapped to the state names
// already used in addresses so both sources aggregate into the same buckets.
const INDIAN_STATE_BY_CODE = {
    AN: 'Andaman and Nicobar Islands',
    AP: 'Andhra Pradesh',
    AR: 'Arunachal Pradesh',
    AS: 'Assam',
    BR: 'Bihar',
    CH: 'Chandigarh',
    CT: 'Chhattisgarh',
    CG: 'Chhattisgarh',
    DL: 'Delhi',
    DN: 'Dadra and Nagar Haveli and Daman and Diu',
    DD: 'Dadra and Nagar Haveli and Daman and Diu',
    GA: 'Goa',
    GJ: 'Gujarat',
    HR: 'Haryana',
    HP: 'Himachal Pradesh',
    JH: 'Jharkhand',
    JK: 'Jammu and Kashmir',
    KA: 'Karnataka',
    KL: 'Kerala',
    LA: 'Ladakh',
    LD: 'Lakshadweep',
    MH: 'Maharashtra',
    ML: 'Meghalaya',
    MN: 'Manipur',
    MP: 'Madhya Pradesh',
    MZ: 'Mizoram',
    NL: 'Nagaland',
    OD: 'Odisha',
    OR: 'Odisha',
    PB: 'Punjab',
    PY: 'Puducherry',
    RJ: 'Rajasthan',
    SK: 'Sikkim',
    TG: 'Telangana',
    TS: 'Telangana',
    TN: 'Tamil Nadu',
    TR: 'Tripura',
    UK: 'Uttarakhand',
    UT: 'Uttarakhand',
    UP: 'Uttar Pradesh',
    WB: 'West Bengal'
};

// Loopback, RFC1918 and carrier-grade NAT ranges never resolve to a location.
const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc|fd)/i;

export const normalizeIp = (value = '') => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    // Express may hand back an IPv4-mapped IPv6 address.
    const unmapped = raw.replace(/^::ffff:/i, '');
    return unmapped.split('%')[0];
};

/**
 * Best-effort state for a request IP. Returns '' when the address is private,
 * unresolvable, or outside India — callers keep their existing fallback.
 */
export const resolveStateFromIp = (value = '') => {
    const ip = normalizeIp(value);
    if (!ip || PRIVATE_IP.test(ip)) return '';

    try {
        const location = geoip.lookup(ip);
        if (!location || location.country !== 'IN') return '';
        return INDIAN_STATE_BY_CODE[String(location.region || '').toUpperCase()] || '';
    } catch {
        return '';
    }
};

/**
 * The client address, preferring what nginx forwarded. Express only populates
 * req.ip correctly once 'trust proxy' is set.
 */
export const getClientIp = (req) => {
    const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return normalizeIp(forwarded || req?.headers?.['x-real-ip'] || req?.ip || '');
};

export const __testables = { INDIAN_STATE_BY_CODE, PRIVATE_IP };
