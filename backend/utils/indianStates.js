// Canonical Indian states and union territories, plus an alias map built from
// the values actually found in this database. Address state was a free-text
// field, so it accumulated misspellings, districts and towns; those all split
// one real state's traffic across several buckets in the analytics.

export const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
    'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
    'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
    'West Bengal'
];

export const INDIAN_UNION_TERRITORIES = [
    'Andaman and Nicobar Islands', 'Chandigarh',
    'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
    'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export const ALL_INDIAN_STATES = [...INDIAN_STATES, ...INDIAN_UNION_TERRITORIES].sort();

// Collapses internal whitespace too: several rows differed only by a stray
// double space, which is why they read as unrecognised.
const key = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const CANONICAL_BY_KEY = new Map(ALL_INDIAN_STATES.map((name) => [key(name), name]));

// Every alias below was observed in this data. Districts and towns map to the
// state that contains them; anything genuinely ambiguous is deliberately absent
// so it stays Unknown rather than being guessed at.
const ALIASES = {
    // Odisha — spelling variants
    orissa: 'Odisha', odisa: 'Odisha', odhisha: 'Odisha', odish: 'Odisha',
    odissa: 'Odisha', 'odisha sundargarh': 'Odisha',
    // Odisha — districts and towns
    dhenkanal: 'Odisha', sundargarh: 'Odisha', 'sundar garh': 'Odisha',
    bhadrak: 'Odisha', angul: 'Odisha', koraput: 'Odisha', mayurbhanj: 'Odisha',
    keonjhar: 'Odisha', kedujhar: 'Odisha', ganjam: 'Odisha', khordha: 'Odisha',
    khurda: 'Odisha', cuttack: 'Odisha', chatrapur: 'Odisha', mohana: 'Odisha',
    jajpur: 'Odisha', balasore: 'Odisha', balesore: 'Odisha', balesar: 'Odisha',
    balaswer: 'Odisha', baisiga: 'Odisha', belpada: 'Odisha', bahalda: 'Odisha',
    barkot: 'Odisha', kalipadar: 'Odisha', dudhapasi: 'Odisha',
    bhubaneswar: 'Odisha', bubonaswer: 'Odisha', puri: 'Odisha',
    rourkela: 'Odisha', sambalpur: 'Odisha', berhampur: 'Odisha',

    // Other states — spelling variants
    tamilnadu: 'Tamil Nadu', 'tamil nadu ': 'Tamil Nadu',
    andhrapradesh: 'Andhra Pradesh', 'andhra pradesh ': 'Andhra Pradesh',
    gujrat: 'Gujarat', gujurat: 'Gujarat',
    telengana: 'Telangana', telagana: 'Telangana', 'hyderabad telangana': 'Telangana',
    hyderabad: 'Telangana',
    'madhya pradesh': 'Madhya Pradesh',
    uttarakhand: 'Uttarakhand', uttaranchal: 'Uttarakhand',
    pondicherry: 'Puducherry',
    'new delhi': 'Delhi', delhi: 'Delhi',
    'west bangal': 'West Bengal', westbengal: 'West Bengal',
    maharastra: 'Maharashtra', maharashtra: 'Maharashtra',
    karnatka: 'Karnataka', kerela: 'Kerala',

    // Unambiguous abbreviations. "AP" is deliberately absent: it is equally
    // Andhra Pradesh or Arunachal Pradesh, so it stays Unknown.
    up: 'Uttar Pradesh', mp: 'Madhya Pradesh', tn: 'Tamil Nadu',
    wb: 'West Bengal', hp: 'Himachal Pradesh', jk: 'Jammu and Kashmir',
    ka: 'Karnataka', mh: 'Maharashtra', tg: 'Telangana', ts: 'Telangana',
    od: 'Odisha', ktk: 'Karnataka',

    // Cities that clearly identify a state
    shimla: 'Himachal Pradesh', mumbai: 'Maharashtra', pune: 'Maharashtra',
    bengaluru: 'Karnataka', bangalore: 'Karnataka', chennai: 'Tamil Nadu',
    kolkata: 'West Bengal', ahmedabad: 'Gujarat', kochi: 'Kerala'
};

/**
 * Returns the canonical state name, or '' when the value is not recognisable.
 * Callers decide what an empty result means — usually 'Unknown'.
 */
export const canonicalizeState = (value = '') => {
    const normalized = key(value);
    if (!normalized) return '';
    return CANONICAL_BY_KEY.get(normalized) || ALIASES[normalized] || '';
};

export const isCanonicalState = (value = '') => CANONICAL_BY_KEY.has(key(value));
