import axios from 'axios';
import Setting from '../models/Setting.js';

const DEFAULT_EKART_BASE_URL = 'https://app.elite.ekartlogistics.in';
const DEFAULT_EKART_TRACKING_PATH = '/api/v1/track/{id}';
const DEFAULT_EKART_CREATE_PATH = '/api/v1/package/create';
const DEFAULT_EKART_CANCEL_PATH = '/api/v1/package/cancel';
const DEFAULT_EKART_TOKEN_PATH = '/integrations/v2/auth/token/{client_id}';
const ekartTokenCache = new Map();

const sanitizeText = (value = '') => (
    String(value || '')
        .replace(/[&#%;\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
);

const normalizePhone = (value = '') => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return digits;
};

const getEkartErrorMessage = (error, fallbackMessage) => {
    const responseData = error?.response?.data;
    const description = sanitizeText(responseData?.description || '');
    const message = sanitizeText(responseData?.message || '');
    const code = sanitizeText(responseData?.code || '');

    if (description && message && description !== message) {
        return code
            ? `${message}: ${description} (${code})`
            : `${message}: ${description}`;
    }

    if (description) {
        return code ? `${description} (${code})` : description;
    }

    if (message) {
        return code ? `${message} (${code})` : message;
    }

    return fallbackMessage || error?.message || 'Ekart request failed.';
};

const formatDate = (value = Date.now()) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toPositiveInteger = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.round(parsed);
};

const joinUrl = (baseUrl = '', path = '') => {
    const normalizedBase = String(baseUrl || '').trim().replace(/\/$/, '');
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath) return normalizedBase;
    if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
    return `${normalizedBase}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
};

const getTrackingNumber = (payload = {}) => {
    if (!payload || typeof payload !== 'object') return '';

    const candidates = [
        payload?.trackingNumber,
        payload?.tracking_number,
        payload?.awb,
        payload?.waybill,
        payload?.consignmentNumber,
        payload?.consignment_number,
        payload?.shipmentId,
        payload?.shipment_id,
        payload?.referenceNumber,
        payload?.reference_number
    ];

    for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (value) return value;
    }

    if (Array.isArray(payload?.shipments)) {
        for (const shipment of payload.shipments) {
            const value = getTrackingNumber(shipment);
            if (value) return value;
        }
    }

    if (payload?.data && typeof payload.data === 'object') {
        return getTrackingNumber(payload.data);
    }

    return '';
};

const getCurrentStatus = (payload = {}) => {
    const candidates = [
        payload?.currentStatus,
        payload?.current_status,
        payload?.status,
        payload?.shipmentStatus,
        payload?.shipment_status
    ];

    for (const candidate of candidates) {
        const value = sanitizeText(candidate);
        if (value) return value;
    }

    return '';
};

const getPaymentMode = (order) => String(order?.paymentMethod || '').trim().toUpperCase() === 'COD'
    ? 'COD'
    : 'Prepaid';

const RAW_TO_USER_TRACKING_STEP = {
    created: 'Processing',
    booked: 'Processing',
    pending: 'Processing',
    processing: 'Processing',
    manifested: 'Processing',
    'shipment created': 'Processing',
    scheduled: 'Scheduled',
    'pickup scheduled': 'Scheduled',
    'not picked': 'Not Picked',
    picked: 'Picked Up',
    'picked up': 'Picked Up',
    dispatched: 'Dispatched',
    shipped: 'Dispatched',
    'in transit': 'In Transit',
    transit: 'In Transit',
    'out for delivery': 'Out for Delivery',
    ofd: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    rto: 'RTO',
    dto: 'DTO',
    collected: 'Collected'
};

const getMappedTrackingStep = (rawStatus = '') => {
    const normalized = sanitizeText(rawStatus).toLowerCase().replace(/[_-]+/g, ' ').trim();
    if (RAW_TO_USER_TRACKING_STEP[normalized]) return RAW_TO_USER_TRACKING_STEP[normalized];
    // Couriers send free text ("shipment delivered", "delivery success"). Match the longest key contained in it.
    const key = Object.keys(RAW_TO_USER_TRACKING_STEP)
        .filter((candidate) => normalized.includes(candidate))
        .sort((a, b) => b.length - a.length)[0];
    return key ? RAW_TO_USER_TRACKING_STEP[key] : '';
};

const buildShipmentPayload = (order, settings) => {
    const shippingAddress = order?.shippingAddress || {};
    const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : [];
    const totalQuantity = orderItems.reduce((sum, item) => sum + (Number(item?.qty) || 0), 0) || 1;
    const totalAmount = Math.max(1, Number(order?.totalPrice || 0));
    const taxValue = Math.max(0, Number(order?.taxPrice || 0));
    const taxableAmount = Math.max(1, Number((totalAmount - taxValue).toFixed(2)));
    const paymentMode = getPaymentMode(order);
    const sellerName = sanitizeText(settings?.sellerName || settings?.ekartClientName || 'Jaipurio');
    const sellerAddress = sanitizeText(settings?.sellerAddress || '');
    const gstNumber = sanitizeText(settings?.gstNumber || '');
    const productsDescription = sanitizeText(orderItems.map((item) => item?.name || 'Item').join(', ')).slice(0, 250) || 'General merchandise';
    const dropLocationAddress = sanitizeText(shippingAddress?.street || '');
    const consigneePhone = normalizePhone(shippingAddress?.phone || '');
    const consigneeAlternatePhoneCandidates = [
        shippingAddress?.alternatePhone,
        order?.alternatePhone,
        order?.user?.alternatePhone,
        settings?.contactPhone
    ].map((value) => normalizePhone(value || ''));
    const consigneeAlternatePhone = consigneeAlternatePhoneCandidates.find((value) => value && value !== consigneePhone) || '';
    const pickupAlias = sanitizeText(settings?.ekartPickupLocation || '');

    if (!consigneePhone) {
        throw new Error('Customer phone number is required before creating an Ekart shipment.');
    }

    if (!consigneeAlternatePhone) {
        throw new Error('Ekart requires an alternate customer phone number. Save a support/contact phone in Settings or add an alternate phone for the customer.');
    }

    return {
        seller_name: sellerName,
        seller_address: sellerAddress,
        seller_gst_tin: gstNumber,
        seller_gst_amount: 0,
        consignee_gst_amount: 0,
        integrated_gst_amount: 0,
        order_number: sanitizeText(order?.displayId || order?._id || ''),
        invoice_number: sanitizeText(order?.invoiceNumber || order?.displayId || order?._id || ''),
        invoice_date: formatDate(order?.createdAt),
        consignee_name: sanitizeText(shippingAddress?.name || 'Customer'),
        consignee_alternate_phone: consigneeAlternatePhone,
        products_desc: productsDescription,
        payment_mode: paymentMode,
        category_of_goods: 'General Merchandise',
        total_amount: totalAmount,
        tax_value: taxValue,
        taxable_amount: taxableAmount,
        commodity_value: taxableAmount.toFixed(2),
        cod_amount: paymentMode === 'COD' ? (order?.remainingCodBalance !== undefined ? Number(order.remainingCodBalance) : totalAmount) : 0,
        quantity: totalQuantity,
        weight: toPositiveInteger(order?.shippingWeight || totalQuantity * 500, 500),
        length: toPositiveInteger(order?.shippingLength, 10),
        height: toPositiveInteger(order?.shippingHeight, 10),
        width: toPositiveInteger(order?.shippingWidth, 10),
        drop_location: {
            location_type: 'Home',
            address: dropLocationAddress,
            city: sanitizeText(shippingAddress?.city || ''),
            state: sanitizeText(shippingAddress?.state || ''),
            country: sanitizeText(shippingAddress?.country || 'India') || 'India',
            name: sanitizeText(shippingAddress?.name || 'Customer'),
            phone: Number(consigneePhone || 0),
            pin: Number(String(shippingAddress?.postalCode || '').trim() || 0)
        },
        pickup_location: pickupAlias ? { name: pickupAlias } : undefined,
        return_location: pickupAlias ? { name: pickupAlias } : undefined
    };
};

const getCachedTokenKey = (config) => `${config.baseUrl}|${config.clientId}|${config.username}`;

const resolveTokenUrl = (baseUrl, clientId, tokenPath = DEFAULT_EKART_TOKEN_PATH) => {
    const normalizedPath = String(tokenPath || DEFAULT_EKART_TOKEN_PATH).trim();
    const resolvedPath = normalizedPath.replace('{client_id}', encodeURIComponent(clientId));
    return joinUrl(baseUrl, resolvedPath);
};

const fetchEkartAccessToken = async (config) => {
    try {
        if (config.apiKey && !config.clientId) {
            return config.apiKey;
        }

        if (!config.clientId || !config.username || !config.password) {
            throw new Error('Ekart credentials are incomplete. Please save Client ID, Username, and Password in Admin > API Credentials.');
        }

        const cacheKey = getCachedTokenKey(config);
        const cachedEntry = ekartTokenCache.get(cacheKey);
        if (cachedEntry && cachedEntry.expiresAt > Date.now() + 60_000) {
            return cachedEntry.accessToken;
        }

        const { data } = await axios.post(
            resolveTokenUrl(config.baseUrl, config.clientId, config.tokenPath),
            {
                username: config.username,
                password: config.password
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 45000
            }
        );

        const accessToken = sanitizeText(data?.access_token || '');
        const expiresInSeconds = Number(data?.expires_in || 0);
        if (!accessToken) {
            throw new Error(sanitizeText(data?.message || data?.description || 'Ekart access token could not be fetched.'));
        }

        ekartTokenCache.set(cacheKey, {
            accessToken,
            expiresAt: Date.now() + Math.max(300, expiresInSeconds) * 1000
        });

        return accessToken;
    } catch (error) {
        throw new Error(getEkartErrorMessage(error, 'Ekart access token could not be fetched.'));
    }
};

const buildAuthHeaders = async (config) => {
    const accessToken = await fetchEkartAccessToken(config);
    return {
        Authorization: `Bearer ${accessToken}`
    };
};

const getEkartSettings = async () => {
    const settings = await Setting.findOne().select('+ekartPassword +ekartApiKey').lean();
    const baseUrl = String(settings?.ekartBaseUrl || '').trim();
    const trackingBaseUrl = String(settings?.ekartTrackingBaseUrl || baseUrl).trim();

    return {
        settings,
        baseUrl: (baseUrl || DEFAULT_EKART_BASE_URL).replace(/\/$/, ''),
        trackingBaseUrl: (trackingBaseUrl || baseUrl || DEFAULT_EKART_BASE_URL).replace(/\/$/, ''),
        clientId: String(settings?.ekartClientId || '').trim(),
        username: String(settings?.ekartUsername || '').trim(),
        password: String(settings?.ekartPassword || '').trim(),
        apiKey: String(settings?.ekartApiKey || '').trim(),
        createShipmentPath: String(settings?.ekartCreateShipmentPath || DEFAULT_EKART_CREATE_PATH).trim(),
        trackingPath: String(settings?.ekartTrackingPath || DEFAULT_EKART_TRACKING_PATH).trim(),
        cancelPath: String(settings?.ekartCancelPath || DEFAULT_EKART_CANCEL_PATH).trim(),
        tokenPath: DEFAULT_EKART_TOKEN_PATH,
        clientName: String(settings?.ekartClientName || '').trim(),
        pickupLocation: String(settings?.ekartPickupLocation || '').trim()
    };
};

const normalizePublicTrackingResponse = (responseData, fallbackTrackingNumber = '') => {
    const details = Array.isArray(responseData?.track?.details) ? responseData.track.details : [];
    const scans = details.map((entry) => ({
        status: sanitizeText(entry?.status || entry?.event || entry?.description || responseData?.track?.status || ''),
        location: sanitizeText(entry?.location || responseData?.track?.location || ''),
        time: entry?.ctime || entry?.time || null,
        remarks: sanitizeText(entry?.desc || '')
    })).filter((entry) => entry.status || entry.time);

    if (!scans.length && responseData?.track) {
        scans.push({
            status: sanitizeText(responseData.track.status || ''),
            location: sanitizeText(responseData.track.location || ''),
            time: responseData.track.ctime || responseData.track.pickupTime || null,
            remarks: sanitizeText(responseData.track.desc || '')
        });
    }

    const currentStatus = getCurrentStatus(responseData?.track || {}) || sanitizeText(responseData?.track?.status || '');
    const currentLocation = sanitizeText(responseData?.track?.location || '');

    return {
        trackingNumber: fallbackTrackingNumber || sanitizeText(responseData?.order_number || ''),
        currentStatus,
        mappedCurrentStep: getMappedTrackingStep(currentStatus),
        currentLocation,
        lastUpdatedAt: responseData?.track?.ctime || responseData?.track?.pickupTime || null,
        expectedDeliveryDate: responseData?.edd || null,
        stepTimes: {},
        scans,
        rawResponse: responseData
    };
};

const normalizeRawTrackingResponse = (responseData, fallbackTrackingNumber = '') => {
    const rawEntry = responseData?.[fallbackTrackingNumber] || Object.values(responseData || {})[0] || {};
    const history = Array.isArray(rawEntry?.history) ? rawEntry.history : [];
    const scans = history.map((entry) => ({
        status: sanitizeText(entry?.status || entry?.event || entry?.description || ''),
        location: sanitizeText(entry?.location || entry?.hub || entry?.city || ''),
        time: entry?.time || entry?.ctime || entry?.timestamp || null,
        remarks: sanitizeText(entry?.desc || entry?.remarks || '')
    })).filter((entry) => entry.status || entry.time);

    const stepTimes = {};
    scans
        .sort((first, second) => new Date(first.time || 0).getTime() - new Date(second.time || 0).getTime())
        .forEach((scan) => {
            const mappedStep = getMappedTrackingStep(scan.status);
            if (mappedStep && scan.time && !stepTimes[mappedStep]) {
                stepTimes[mappedStep] = scan.time;
            }
        });

    const currentStatus = getCurrentStatus(rawEntry) || sanitizeText(scans[scans.length - 1]?.status || '');
    const currentLocation = sanitizeText(
        rawEntry?.currentLocation ||
        rawEntry?.current_location ||
        rawEntry?.current_hub?.name ||
        scans[scans.length - 1]?.location ||
        ''
    );

    return {
        trackingNumber: getTrackingNumber(rawEntry) || fallbackTrackingNumber,
        currentStatus,
        mappedCurrentStep: getMappedTrackingStep(currentStatus),
        currentLocation,
        lastUpdatedAt: rawEntry?.lastUpdatedAt || rawEntry?.updatedAt || scans[scans.length - 1]?.time || null,
        expectedDeliveryDate: rawEntry?.expectedDeliveryDate || rawEntry?.expected_delivery_date || null,
        stepTimes,
        scans,
        rawResponse: responseData
    };
};

const normalizeTrackingResponse = (responseData, fallbackTrackingNumber = '') => {
    if (responseData?.track) {
        return normalizePublicTrackingResponse(responseData, fallbackTrackingNumber);
    }

    return normalizeRawTrackingResponse(responseData, fallbackTrackingNumber);
};

const resolveTrackingUrl = (baseUrl, path, trackingNumber) => {
    const normalizedPath = String(path || DEFAULT_EKART_TRACKING_PATH).trim();
    const resolvedPath = normalizedPath
        .replace('{id}', encodeURIComponent(trackingNumber))
        .replace('{wbn}', encodeURIComponent(trackingNumber));
    return joinUrl(baseUrl, resolvedPath);
};

export const createEkartShipment = async (order) => {
    try {
        const config = await getEkartSettings();
        if (!config.baseUrl || (!config.clientId && !config.apiKey)) {
            throw new Error('Ekart credentials are incomplete. Please save base URL and Client ID in Admin > API Credentials.');
        }

        const payload = buildShipmentPayload(order, config.settings);
        const authHeaders = await buildAuthHeaders(config);
        const { data } = await axios.put(
            joinUrl(config.baseUrl, config.createShipmentPath),
            payload,
            {
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json'
                },
                timeout: 20000
            }
        );

        const trackingNumber = getTrackingNumber(data) || sanitizeText(data?.tracking_id || '');
        if (!trackingNumber) {
            throw new Error(sanitizeText(data?.remark || data?.message || data?.error || 'Ekart shipment was not created successfully.'));
        }

        return {
            trackingNumber,
            providerOrderId: sanitizeText(order?.displayId || order?._id || ''),
            pickupLocation: config.pickupLocation,
            requestPayload: payload,
            responsePayload: data
        };
    } catch (error) {
        throw new Error(getEkartErrorMessage(error, 'Ekart shipment was not created successfully.'));
    }
};

export const fetchEkartTracking = async (orderOrTrackingNumber) => {
    try {
        const config = await getEkartSettings();
        const trackingNumber = String(
            typeof orderOrTrackingNumber === 'string'
                ? orderOrTrackingNumber
                : orderOrTrackingNumber?.ekart?.trackingNumber || ''
        ).trim();

        if (!config.trackingBaseUrl) {
            throw new Error('Ekart tracking base URL is missing. Please save it in Admin > API Credentials.');
        }

        if (!trackingNumber) {
            throw new Error('Ekart tracking number is not available for this order yet.');
        }

        const authHeaders = await buildAuthHeaders(config);
        const { data } = await axios.get(
            resolveTrackingUrl(config.trackingBaseUrl, config.trackingPath, trackingNumber),
            {
                headers: authHeaders,
                timeout: 20000
            }
        );

        return normalizeTrackingResponse(data, trackingNumber);
    } catch (error) {
        throw new Error(getEkartErrorMessage(error, 'Failed to fetch Ekart tracking.'));
    }
};

export const cancelEkartShipment = async (order) => {
    try {
        const config = await getEkartSettings();
        const trackingNumber = String(order?.ekart?.trackingNumber || '').trim();

        if (!config.baseUrl || (!config.clientId && !config.apiKey)) {
            throw new Error('Ekart credentials are incomplete. Please save base URL and Client ID in Admin > API Credentials.');
        }

        if (!trackingNumber) {
            throw new Error('Ekart tracking number is not available for this order yet.');
        }

        const authHeaders = await buildAuthHeaders(config);
        const { data } = await axios.delete(
            joinUrl(config.baseUrl, config.cancelPath),
            {
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json'
                },
                params: {
                    tracking_id: trackingNumber
                },
                timeout: 20000
            }
        );

        return {
            requestPayload: {
                tracking_id: trackingNumber
            },
            responsePayload: data
        };
    } catch (error) {
        throw new Error(getEkartErrorMessage(error, 'Failed to cancel Ekart shipment.'));
    }
};

export const __testables = { getMappedTrackingStep };
