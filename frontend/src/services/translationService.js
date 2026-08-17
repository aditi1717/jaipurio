/**
 * Service to handle Google Cloud Translation API interactions.
 * Includes caching in localStorage to minimize API costs and improve performance.
 */

const API_KEY = import.meta.env.VITE_GOOGLE_TRANSLATION_API_KEY || '';
const API_URL = 'https://translation.googleapis.com/language/translate/v2';
const CACHE_KEY_PREFIX = 'trans_cache_v3_';
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;
const memoryTranslationCache = new Map();
const inflightTranslationRequests = new Map();

// List of words that should NOT be translated
const PROTECTED_WORDS = [
    'Apple', 'Samsung', 'Realme', 'Xiaomi', 'Redmi', 'Oppo', 'Vivo',
    'OnePlus', 'Sony', 'LG', 'Google', 'Microsoft', 'Dell', 'HP',
    'Lenovo', 'Asus', 'Acer', 'Motorola', 'Nokia', 'Huawei', 'Honor',
    'Infinix', 'Tecno', 'Itel', 'Lava', 'Nothing', 'Poco', 'iQOO',
    'Flipkart', 'Amazon', 'Jaipurio', 'iPhone', 'iPad', 'MacBook',
    'Galaxy', 'Note', 'Ultra', 'Pro', 'Max', 'Plus', 'Mini', 'Air',
    'Watch', 'Buds', 'AirPods'
];

const normalizeText = (text) => String(text || '').trim();
const getCacheKey = (text, targetLang) => `${CACHE_KEY_PREFIX}${targetLang}_${btoa(encodeURIComponent(normalizeText(text)))}`;

const readCachedTranslation = (text, targetLang) => {
    if (!text || !targetLang || targetLang === 'en') return text;

    const cacheKey = getCacheKey(text, targetLang);
    const memoryCached = memoryTranslationCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_EXPIRATION) {
        return memoryCached.value;
    }

    try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;

        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp >= CACHE_EXPIRATION) {
            localStorage.removeItem(cacheKey);
            return null;
        }

        memoryTranslationCache.set(cacheKey, parsed);
        return parsed.value;
    } catch {
        return null;
    }
};

const writeCachedTranslation = (cacheKey, value) => {
    const payload = {
        value,
        timestamp: Date.now()
    };

    memoryTranslationCache.set(cacheKey, payload);

    try {
        localStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch {
        console.warn('LocalStorage full, cannot cache translation');
    }
};

/**
 * Replaces protected words with placeholders
 */
const maskProtectedWords = (text) => {
    let maskedText = text;
    const placeholders = [];

    PROTECTED_WORDS.forEach((word) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(maskedText)) {
            const matches = maskedText.match(regex);
            matches.forEach((match) => {
                const placeholder = `__BP${placeholders.length}__`;
                maskedText = maskedText.replace(match, placeholder);
                placeholders.push({ placeholder, original: match });
            });
        }
    });

    return { maskedText, placeholders };
};

/**
 * Restores protected words from placeholders
 */
const unmaskProtectedWords = (text, placeholders) => {
    let unmaskedText = text;
    for (let i = placeholders.length - 1; i >= 0; i -= 1) {
        const { placeholder, original } = placeholders[i];
        unmaskedText = unmaskedText.split(placeholder).join(original);
    }
    return unmaskedText;
};

export const getCachedTranslationSync = (text, targetLang) => readCachedTranslation(text, targetLang);

/**
 * Fetches translation from Google API or local cache.
 * @param {string} text
 * @param {string} targetLang
 * @returns {Promise<string>}
 */
export const translateText = async (text, targetLang) => {
    if (!text || !targetLang || targetLang === 'en') {
        return text;
    }

    if (!API_KEY) {
        console.error('CRITICAL: VITE_GOOGLE_TRANSLATION_API_KEY is missing in .env file!');
        return text;
    }

    const normalizedText = normalizeText(text);
    const cacheKey = getCacheKey(normalizedText, targetLang);
    const cachedValue = readCachedTranslation(normalizedText, targetLang);

    if (cachedValue !== null) {
        return cachedValue;
    }

    if (inflightTranslationRequests.has(cacheKey)) {
        return inflightTranslationRequests.get(cacheKey);
    }

    const request = (async () => {
        try {
            const { maskedText, placeholders } = maskProtectedWords(normalizedText);
            const response = await fetch(`${API_URL}?key=${API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: maskedText,
                    target: targetLang,
                    format: 'text',
                    source: 'en'
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('Google API Error:', JSON.stringify(data.error, null, 2));
                if (data.error.code === 400 && data.error.message === 'API key not valid. Please pass a valid API key.') {
                    console.error('ACTION REQUIRED: Check your Google Cloud Console to ensure the API key is valid, active, and has the Cloud Translation API enabled.');
                }
                return text;
            }

            let translatedText = data.data.translations[0].translatedText;
            translatedText = unmaskProtectedWords(translatedText, placeholders);

            if (targetLang === 'hi') {
                translatedText = translatedText.replace(/\|/g, '\u0964');
            }

            writeCachedTranslation(cacheKey, translatedText);
            return translatedText;
        } catch (error) {
            console.error('Translation Service Network/System Error:', error);
            return text;
        } finally {
            inflightTranslationRequests.delete(cacheKey);
        }
    })();

    inflightTranslationRequests.set(cacheKey, request);
    return request;
};

export const translateBatch = async () => {
    // Implementation for array of strings if needed to reduce HTTP overhead
};
