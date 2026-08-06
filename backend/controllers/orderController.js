import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import Order from '../models/Order.js';
import Counter from '../models/Counter.js';
import PaymentClaim from '../models/PaymentClaim.js';
import Product from '../models/Product.js';
import PinCode from '../models/PinCode.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js';
import Agent from '../models/Agent.js';
import { refundCancelledRazorpayOrder, restoreOrderStock } from '../utils/orderCancellation.js';
import { cancelDelhiveryShipment, createDelhiveryShipment, fetchDelhiveryTracking } from '../utils/delhiveryService.js';
import { cancelEkartShipment, createEkartShipment, fetchEkartTracking } from '../utils/ekartService.js';
import { calculateOrderPrices } from '../utils/priceCalculator.js';
import { mapWithConcurrency } from '../utils/asyncUtils.js';

const DELHIVERY_SYNC_TRIGGER_STATUSES = new Set([
    'Confirmed',
    'Packed',
    'Dispatched',
    'Out for Delivery',
    'Delivered'
]);

const MANUAL_TRACKING_STATUSES = new Set([
    'Pending',
    'Confirmed',
    'Packed',
    'Dispatched',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
    'Cancellation Requested'
]);

const ORDER_LIST_SELECT = [
    'displayId',
    'invoiceNumber',
    'transactionId',
    'createdAt',
    'updatedAt',
    'status',
    'paymentMethod',
    'paymentResult',
    'itemsPrice',
    'shippingPrice',
    'taxPrice',
    'totalPrice',
    'shippingAddress',
    'retailerDetails',
    'orderItems',
    'referral',
    'fulfillment',
    'user',
    'delhivery.waybill',
    'delhivery.providerOrderId',
    'delhivery.pickupLocation',
    'delhivery.syncedAt',
    'delhivery.cancelledAt',
    'delhivery.lastError',
    'ekart.trackingNumber',
    'ekart.providerOrderId',
    'ekart.pickupLocation',
    'ekart.syncedAt',
    'ekart.cancelledAt',
    'ekart.lastError'
].join(' ');
const ORDER_SYNC_CONCURRENCY = 10;

const normalizeReferralCode = (value = '') =>
    String(value || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .trim();

const getEffectivePurchaseLimit = (product, availableStock) => {
    const stockLimit = Math.max(0, Number(availableStock) || 0);
    const configuredLimit = Number(product?.maxOrderQuantity);

    if (!Number.isFinite(configuredLimit) || configuredLimit <= 0) {
        return stockLimit;
    }

    return Math.min(stockLimit, configuredLimit);
};

const getProductVariantHeadings = (product) => (
    Array.isArray(product?.variantHeadings)
        ? product.variantHeadings.filter((heading) => String(heading?.name || '').trim())
        : []
);

const normalizeVariantObject = (variant) => {
    if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
        return {};
    }

    return Object.entries(variant).reduce((acc, [key, value]) => {
        const normalizedKey = String(key || '').trim();
        const normalizedValue = String(value || '').trim();
        if (!normalizedKey || !normalizedValue) return acc;
        acc[normalizedKey] = normalizedValue;
        return acc;
    }, {});
};

const findMatchingSkuForVariant = (product, variant) => {
    const normalizedVariant = normalizeVariantObject(variant);
    const itemKeys = Object.keys(normalizedVariant);
    if (!itemKeys.length) return null;

    return (Array.isArray(product?.skus) ? product.skus : []).find((sku) => {
        const combinationSource = sku?.combination instanceof Map
            ? Object.fromEntries(sku.combination)
            : sku?.combination;
        const combination = normalizeVariantObject(combinationSource);
        const combinationKeys = Object.keys(combination);

        if (itemKeys.length !== combinationKeys.length) return false;
        return itemKeys.every((key) => String(normalizedVariant[key]) === String(combination[key]));
    }) || null;
};

const validateAndResolveOrderItemVariant = (product, item) => {
    const productVariantHeadings = getProductVariantHeadings(product);
    const normalizedVariant = normalizeVariantObject(item?.variant);
    const hasVariantProduct = productVariantHeadings.length > 0;

    if (!hasVariantProduct) {
        return {
            normalizedVariant,
            matchingSku: null
        };
    }

    if (!Object.keys(normalizedVariant).length) {
        const error = new Error(`Please reselect the variant for ${item?.name || product?.name || 'this product'} before placing the order.`);
        error.statusCode = 400;
        throw error;
    }

    for (const heading of productVariantHeadings) {
        const headingName = String(heading?.name || '').trim();
        const selectedValue = normalizedVariant[headingName];
        const validOptions = Array.isArray(heading?.options)
            ? heading.options.map((option) => String(option?.name || '').trim()).filter(Boolean)
            : [];

        if (!selectedValue) {
            const error = new Error(`Please select ${headingName} for ${item?.name || product?.name || 'this product'}.`);
            error.statusCode = 400;
            throw error;
        }

        if (validOptions.length > 0 && !validOptions.includes(selectedValue)) {
            const error = new Error(`The selected ${headingName} for ${item?.name || product?.name || 'this product'} is no longer available.`);
            error.statusCode = 400;
            throw error;
        }
    }

    const matchingSku = findMatchingSkuForVariant(product, normalizedVariant);
    if (!matchingSku) {
        const error = new Error(`The selected variant for ${item?.name || product?.name || 'this product'} is invalid or unavailable.`);
        error.statusCode = 400;
        throw error;
    }

    return {
        normalizedVariant,
        matchingSku
    };
};

const isOrderAccessibleByUser = (order, user) => {
    const orderUserId = order?.user?.toString();
    const currentUserId = user?._id?.toString();
    // Keep this list in sync with the `admin` middleware, or subadmins get 401
    // on order detail while passing the route guard.
    const isAdmin = Boolean(user && (user.isAdmin || ['admin', 'superadmin', 'subadmin', 'editor', 'moderator'].includes(user.role)));

    return {
        orderUserId,
        currentUserId,
        isAdmin,
        isAllowed: orderUserId === currentUserId || isAdmin
    };
};

const buildOrderListFilter = ({ search, status, user, userId, startDate, endDate }) => {
    const filter = {};

    const normalizedSearch = String(search || '').trim();
    if (normalizedSearch) {
        const searchPattern = normalizedSearch
            .split(/\s+/)
            .filter(Boolean)
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('\\s*');
        const searchRegex = { $regex: searchPattern, $options: 'i' };

        const searchConditions = [
            { displayId: searchRegex },
            { 'shippingAddress.name': searchRegex },
            { 'shippingAddress.email': searchRegex },
            { 'shippingAddress.phone': searchRegex },
            { 'orderItems.name': searchRegex }
        ];

        if (mongoose.Types.ObjectId.isValid(normalizedSearch)) {
            searchConditions.push({ _id: normalizedSearch });
        }

        filter.$or = searchConditions;
    }

    const normalizedStatus = String(status || '').trim();
    if (normalizedStatus && normalizedStatus !== 'All') {
        filter.status = normalizedStatus;
    }

    const normalizedUser = String(user || '').trim();
    if (normalizedUser) {
        filter['shippingAddress.email'] = {
            $regex: `^${normalizedUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            $options: 'i'
        };
    }

    const normalizedUserId = String(userId || '').trim();
    if (normalizedUserId && mongoose.Types.ObjectId.isValid(normalizedUserId)) {
        filter.user = normalizedUserId;
    }

    // Date range (inclusive). Accepts ISO date or datetime; endDate covers the whole day.
    const from = startDate ? new Date(startDate) : null;
    const to = endDate ? new Date(endDate) : null;
    const createdAt = {};
    if (from && !Number.isNaN(from.getTime())) createdAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) to.setHours(23, 59, 59, 999);
        createdAt.$lte = to;
    }
    if (Object.keys(createdAt).length) filter.createdAt = createdAt;

    return filter;
};

const getFulfillmentMode = (order) => {
    const explicitMode = String(order?.fulfillment?.mode || '').trim();
    if (explicitMode && explicitMode !== 'unassigned') {
        return explicitMode;
    }

    if (order?.delhivery?.waybill) return 'delhivery';
    if (order?.ekart?.trackingNumber) return 'ekart';
    return explicitMode || 'unassigned';
};

const PROVIDER_SYNC_TRIGGER_STATUSES = new Set([
    'Confirmed',
    'Packed',
    'Dispatched',
    'Out for Delivery',
    'Delivered'
]);

const INVOICE_PREFIX = 'AEPL26IKRT';
const INVOICE_PAD_LENGTH = 6;
const INVOICE_COUNTER_KEY = 'orderInvoice';
const INVOICE_SEQUENCE_FLOOR = 9;
const INVOICE_NUMBER_PATTERN = new RegExp(`^${INVOICE_PREFIX}(\\d+)$`);

const formatInvoiceNumber = (sequence) => {
    const safeSequence = Math.max(1, Number(sequence) || 1);
    return `${INVOICE_PREFIX}${String(safeSequence).padStart(INVOICE_PAD_LENGTH, '0')}`;
};

const parseInvoiceSequence = (invoiceNumber = '') => {
    const match = String(invoiceNumber || '').trim().match(INVOICE_NUMBER_PATTERN);
    if (!match) return null;

    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getHighestExistingInvoiceSequence = async () => {
    const latestOrderWithInvoice = await Order.findOne({
        invoiceNumber: { $regex: `^${INVOICE_PREFIX}\\d+$` }
    })
        .sort({ invoiceNumber: -1 })
        .select('invoiceNumber')
        .lean();

    return parseInvoiceSequence(latestOrderWithInvoice?.invoiceNumber) || INVOICE_SEQUENCE_FLOOR;
};

const reserveNextInvoiceNumber = async () => {
    let counter = await Counter.findById(INVOICE_COUNTER_KEY);

    if (!counter) {
        const highestExistingSequence = await getHighestExistingInvoiceSequence();

        try {
            counter = await Counter.create({
                _id: INVOICE_COUNTER_KEY,
                seq: highestExistingSequence
            });
        } catch (error) {
            if (error?.code !== 11000) {
                throw error;
            }

            counter = await Counter.findById(INVOICE_COUNTER_KEY);
        }
    }

    const updatedCounter = await Counter.findByIdAndUpdate(
        INVOICE_COUNTER_KEY,
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return formatInvoiceNumber(updatedCounter?.seq);
};

const ensureOrderInvoiceNumber = async (order) => {
    if (!order) return '';

    const existingInvoiceNumber = String(order.invoiceNumber || '').trim();
    if (existingInvoiceNumber) {
        return existingInvoiceNumber;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            order.invoiceNumber = await reserveNextInvoiceNumber();
            await order.save();
            return order.invoiceNumber;
        } catch (error) {
            if (error?.code === 11000 && error?.keyPattern?.invoiceNumber) {
                order.invoiceNumber = undefined;
                continue;
            }

            throw error;
        }
    }

    throw new Error('Failed to assign invoice number to order');
};

const getProviderTrackingIdentifier = (order, provider) => {
    if (provider === 'delhivery') return String(order?.delhivery?.waybill || '').trim();
    if (provider === 'ekart') return String(order?.ekart?.trackingNumber || '').trim();
    return '';
};

const clearInactiveProviderErrors = (order, activeProvider) => {
    order.delhivery = {
        ...order.delhivery,
        lastError: activeProvider === 'delhivery' ? String(order?.delhivery?.lastError || '') : ''
    };
    order.ekart = {
        ...order.ekart,
        lastError: activeProvider === 'ekart' ? String(order?.ekart?.lastError || '') : ''
    };
};

const createShipmentForProvider = async (order, provider) => {
    if (provider === 'delhivery') {
        const shipment = await createDelhiveryShipment(order);
        order.delhivery = {
            ...order.delhivery,
            waybill: shipment.waybill || '',
            providerOrderId: shipment.providerOrderId,
            pickupLocation: shipment.pickupLocation,
            syncedAt: new Date(),
            requestPayload: shipment.requestPayload,
            responsePayload: shipment.responsePayload,
            lastError: ''
        };
        order.ekart = {
            ...order.ekart,
            lastError: ''
        };
        return;
    }

    if (provider === 'ekart') {
        const shipment = await createEkartShipment(order);
        order.ekart = {
            ...order.ekart,
            trackingNumber: shipment.trackingNumber || '',
            providerOrderId: shipment.providerOrderId,
            pickupLocation: shipment.pickupLocation,
            syncedAt: new Date(),
            requestPayload: shipment.requestPayload,
            responsePayload: shipment.responsePayload,
            lastError: ''
        };
        order.delhivery = {
            ...order.delhivery,
            lastError: ''
        };
    }
};

const setProviderCreationError = (order, provider, errorMessage) => {
    if (provider === 'delhivery') {
        order.delhivery = {
            ...order.delhivery,
            waybill: '',
            lastError: errorMessage
        };
        return;
    }

    if (provider === 'ekart') {
        order.ekart = {
            ...order.ekart,
            trackingNumber: '',
            lastError: errorMessage
        };
    }
};

const cancelShipmentForProvider = async (order, provider) => {
    if (provider === 'delhivery' && order?.delhivery?.waybill) {
        const cancellation = await cancelDelhiveryShipment(order);
        order.delhivery = {
            ...order.delhivery,
            cancelledAt: new Date(),
            cancelResponsePayload: cancellation.responsePayload,
            lastError: ''
        };
        return;
    }

    if (provider === 'ekart' && order?.ekart?.trackingNumber) {
        const cancellation = await cancelEkartShipment(order);
        order.ekart = {
            ...order.ekart,
            cancelledAt: new Date(),
            cancelResponsePayload: cancellation.responsePayload,
            lastError: ''
        };
    }
};

const setProviderCancellationError = (order, provider, errorMessage) => {
    if (provider === 'delhivery') {
        order.delhivery = {
            ...order.delhivery,
            lastError: errorMessage
        };
        return;
    }

    if (provider === 'ekart') {
        order.ekart = {
            ...order.ekart,
            lastError: errorMessage
        };
    }
};

const getRazorpayCredentials = async () => {
    const settings = await Setting.findOne().select('+razorpayKeySecret razorpayKeyId').lean();
    return {
        keyId: settings?.razorpayKeyId?.trim() || '',
        keySecret: settings?.razorpayKeySecret?.trim() || ''
    };
};

const verifyCapturedOnlinePayment = async (paymentMethod, paymentResult = {}, expectedAmount) => {
    const normalizedPaymentMethod = String(paymentMethod || '').trim().toUpperCase();
    if (!normalizedPaymentMethod || normalizedPaymentMethod === 'COD') {
        return { isPaid: false, paidAt: null, paymentResult: null };
    }

    const paymentId = String(paymentResult?.razorpay_payment_id || paymentResult?.id || '').trim();
    const orderId = String(paymentResult?.razorpay_order_id || '').trim();

    if (!paymentId || !orderId) {
        throw new Error('Online payment confirmation is incomplete. Please try again.');
    }

    const { keyId, keySecret } = await getRazorpayCredentials();
    if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials are not configured');
    }

    const instance = new Razorpay({
        key_id: keyId,
        key_secret: keySecret
    });

    const payment = await instance.payments.fetch(paymentId);
    const gatewayStatus = String(payment?.status || '').trim().toLowerCase();
    const fetchedOrderId = String(payment?.order_id || '').trim();
    const isCaptured = payment?.captured === true || gatewayStatus === 'captured';

    if (fetchedOrderId && fetchedOrderId !== orderId) {
        throw new Error('Payment verification mismatch. Please do not retry this order blindly.');
    }

    if (!isCaptured) {
        throw new Error('Payment is not captured. Order was not created.');
    }

    if (expectedAmount !== undefined) {
        // Razorpay payment.amount is in paise (e.g. 100 paise = 1 INR)
        const expectedAmountInPaise = Math.round(expectedAmount * 100);
        if (Math.abs(Number(payment.amount) - expectedAmountInPaise) > 1) {
            throw new Error('Payment amount mismatch. Order was not created.');
        }
    }

    return {
        isPaid: true,
        paidAt: payment?.captured_at
            ? new Date(Number(payment.captured_at) * 1000)
            : new Date(),
        paymentResult: {
            ...paymentResult,
            id: paymentId,
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId,
            status: gatewayStatus || 'captured',
            update_time: new Date().toISOString(),
            card_network: payment?.card?.network,
            card_last4: payment?.card?.last4,
            card_type: payment?.card?.type
        }
    };
};

const findExistingOnlineOrder = async (paymentMethod, paymentResult = {}) => {
    const normalizedPaymentMethod = String(paymentMethod || '').trim().toUpperCase();
    if (!normalizedPaymentMethod || normalizedPaymentMethod === 'COD') {
        return null;
    }

    const paymentId = String(paymentResult?.razorpay_payment_id || paymentResult?.id || '').trim();
    const orderId = String(paymentResult?.razorpay_order_id || '').trim();

    if (!paymentId && !orderId) {
        return null;
    }

    const conditions = [];
    if (paymentId) {
        conditions.push(
            { transactionId: paymentId },
            { 'paymentResult.id': paymentId },
            { 'paymentResult.razorpay_payment_id': paymentId }
        );
    }
    if (orderId) {
        conditions.push({ 'paymentResult.razorpay_order_id': orderId });
    }

    if (!conditions.length) {
        return null;
    }

    return Order.findOne({ $or: conditions });
};

const claimOnlinePayment = async (paymentMethod, paymentResult = {}) => {
    const normalizedPaymentMethod = String(paymentMethod || '').trim().toUpperCase();
    if (!normalizedPaymentMethod || normalizedPaymentMethod === 'COD') {
        return { claimed: false, claim: null };
    }

    const paymentId = String(paymentResult?.razorpay_payment_id || paymentResult?.id || '').trim();
    const razorpayOrderId = String(paymentResult?.razorpay_order_id || '').trim();

    if (!paymentId) {
        return { claimed: false, claim: null };
    }

    try {
        const claim = await PaymentClaim.create({
            paymentId,
            razorpayOrderId
        });
        return { claimed: true, claim };
    } catch (error) {
        if (error?.code !== 11000) {
            throw error;
        }

        const claim = await PaymentClaim.findOne({
            $or: [
                { paymentId },
                ...(razorpayOrderId ? [{ razorpayOrderId }] : [])
            ]
        });

        return { claimed: false, claim };
    }
};

const syncOrderPaymentFromGateway = async (order) => {
    // 1. If order is already paid, no need to sync from gateway again!
    if (order?.isPaid) {
        return order;
    }

    const normalizedPaymentMethod = String(order?.paymentMethod || '').trim().toUpperCase();
    if (!normalizedPaymentMethod || normalizedPaymentMethod === 'COD') {
        return order;
    }

    const paymentId = String(
        order?.paymentResult?.razorpay_payment_id
        || order?.paymentResult?.id
        || order?.transactionId
        || ''
    ).trim();

    if (!paymentId) {
        return order;
    }

    // 2. Rate limit: If sync happened within the last 2 minutes, do not sync from gateway again!
    const lastUpdated = order?.paymentResult?.update_time;
    if (lastUpdated && (Date.now() - new Date(lastUpdated).getTime() < 2 * 60 * 1000)) {
        return order;
    }

    const { keyId, keySecret } = await getRazorpayCredentials();
    if (!keyId || !keySecret) {
        return order;
    }

    try {
        const instance = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });

        const payment = await instance.payments.fetch(paymentId);
        const gatewayStatus = String(payment?.status || '').trim().toLowerCase();
        const refundStatus = String(payment?.refund_status || '').trim().toLowerCase();
        const isCaptured = payment?.captured === true || gatewayStatus === 'captured';
        const nextPaidAt = payment?.captured_at
            ? new Date(Number(payment.captured_at) * 1000)
            : (order?.paidAt || null);

        const nextPaymentResult = {
            ...(order?.paymentResult || {}),
            id: payment.id || paymentId,
            razorpay_payment_id: payment.id || paymentId,
            razorpay_order_id: payment.order_id || order?.paymentResult?.razorpay_order_id || '',
            status: gatewayStatus || order?.paymentResult?.status || '',
            refund_status: refundStatus || order?.paymentResult?.refund_status || '',
            method: payment.method || order?.paymentResult?.method || '',
            update_time: new Date().toISOString(),
            email_address: payment.email || order?.paymentResult?.email_address || '',
            card_network: payment?.card?.network || order?.paymentResult?.card_network || '',
            card_last4: payment?.card?.last4 || order?.paymentResult?.card_last4 || '',
            card_type: payment?.card?.type || order?.paymentResult?.card_type || ''
        };

        const nextTransactionId = payment.id || order?.transactionId || paymentId;

        if (typeof order?.set === 'function') {
            order.set({
                transactionId: nextTransactionId,
                isPaid: isCaptured,
                paidAt: isCaptured ? nextPaidAt : null,
                paymentResult: nextPaymentResult
            });
            return order;
        }

        return {
            ...order,
            transactionId: nextTransactionId,
            isPaid: isCaptured,
            paidAt: isCaptured ? nextPaidAt : null,
            paymentResult: nextPaymentResult
        };
    } catch (error) {
        return {
            ...(typeof order?.toObject === 'function' ? order.toObject() : order),
            paymentResult: {
                ...(order?.paymentResult || {}),
                gateway_sync_error: error.message || 'Unable to sync payment status'
            }
        };
    }
};

const annotateDuplicatePayments = async (orders = []) => {
    const onlineOrders = orders.filter((order) => String(order?.paymentMethod || '').trim().toUpperCase() !== 'COD');

    if (!onlineOrders.length) {
        return orders;
    }

    const paymentIds = [
        ...new Set(
            onlineOrders
                .map((order) => String(
                    order?.paymentResult?.razorpay_payment_id
                    || order?.paymentResult?.id
                    || order?.transactionId
                    || ''
                ).trim())
                .filter(Boolean)
        )
    ];

    if (!paymentIds.length) {
        return orders;
    }

    const duplicateGroups = await Order.aggregate([
        {
            $match: {
                paymentMethod: { $ne: 'COD' },
                transactionId: { $in: paymentIds }
            }
        },
        {
            $group: {
                _id: '$transactionId',
                count: { $sum: 1 },
                orderIds: { $push: '$_id' },
                displayIds: { $push: '$displayId' }
            }
        },
        {
            $match: {
                count: { $gt: 1 }
            }
        }
    ]);

    const duplicateMap = new Map(
        duplicateGroups.map((group) => [
            String(group._id || '').trim(),
            {
                count: group.count,
                orderIds: group.orderIds.map((id) => String(id)),
                displayIds: group.displayIds
            }
        ])
    );

    return orders.map((order) => {
        const paymentId = String(
            order?.paymentResult?.razorpay_payment_id
            || order?.paymentResult?.id
            || order?.transactionId
            || ''
        ).trim();

        const duplicateInfo = duplicateMap.get(paymentId);
        if (!duplicateInfo) {
            return order;
        }

        if (typeof order?.set === 'function') {
            order.set('paymentAudit', {
                hasDuplicatePayment: true,
                duplicateCount: duplicateInfo.count,
                duplicateOrderIds: duplicateInfo.orderIds,
                duplicateDisplayIds: duplicateInfo.displayIds
            });
            return order;
        }

        return {
            ...order,
            paymentAudit: {
                hasDuplicatePayment: true,
                duplicateCount: duplicateInfo.count,
                duplicateOrderIds: duplicateInfo.orderIds,
                duplicateDisplayIds: duplicateInfo.displayIds
            }
        };
    });
};

const fetchTrackingForProvider = async (order, provider) => {
    if (provider === 'delhivery') {
        return fetchDelhiveryTracking(order);
    }

    if (provider === 'ekart') {
        return fetchEkartTracking(order);
    }

    throw new Error('Tracking is available only for courier-based fulfillment providers.');
};

// @desc    Create new order
// @route   POST /api/orders

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const addOrderItems = async (req, res) => {
    let claimedPayment = null;
    let createdOrderId = null;
    try {
        const {
            orderItems,
            shippingAddress,
            retailerDetails,
            paymentMethod,
            coupon,
            referral,
        } = req.body;
        const normalizedPaymentMethod = String(paymentMethod || '').trim().toUpperCase();
        const isOnlinePayment = normalizedPaymentMethod && normalizedPaymentMethod !== 'COD';

        if (!orderItems || orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        }

        // Calculate prices securely on the backend from database values
        const calculatedPrices = await calculateOrderPrices({
            orderItems,
            shippingAddress,
            coupon
        });

        const itemsPrice = calculatedPrices.itemsPrice;
        const shippingPrice = calculatedPrices.shippingPrice;
        const taxPrice = calculatedPrices.taxPrice;
        const totalPrice = calculatedPrices.totalPrice;
        const resolvedCoupon = calculatedPrices.coupon;
        const productsById = calculatedPrices.productsById;

        const settings = calculatedPrices.settings;
        const codAdvancedActive = normalizedPaymentMethod === 'COD' && 
            settings?.codAdvancedPaymentEnabled && 
            settings?.codAdvancedPaymentAmount > 0;

        let verifiedPayment;
        if (codAdvancedActive) {
            const expectedCodAdvancedAmount = Math.min(totalPrice, settings.codAdvancedPaymentAmount);
            if (expectedCodAdvancedAmount > 0) {
                if (!req.body.paymentResult) {
                    return res.status(400).json({ message: 'COD advanced pre-payment details are required.' });
                }
                verifiedPayment = await verifyCapturedOnlinePayment('ONLINE', req.body.paymentResult, expectedCodAdvancedAmount);
            } else {
                verifiedPayment = { isPaid: false, paidAt: null, paymentResult: null };
            }
        } else {
            verifiedPayment = await verifyCapturedOnlinePayment(paymentMethod, req.body.paymentResult, totalPrice);
        }

        const existingOnlineOrder = await findExistingOnlineOrder(
            codAdvancedActive ? 'ONLINE' : paymentMethod, 
            verifiedPayment.paymentResult
        );

        if (existingOnlineOrder) {
            return res.status(200).json(existingOnlineOrder);
        }

        // Validate Pincode Serviceability
        const pincode = shippingAddress.postalCode;
        if (pincode) {
            const pinCodeRecord = await PinCode.findOne({ code: pincode, isActive: true });
            if (!pinCodeRecord) {
                return res.status(400).json({ message: `Delivery not available for pincode ${pincode}` });
            }
        } else {
            return res.status(400).json({ message: 'Shipping pincode is required' });
        }

        const isRetailer = Boolean(retailerDetails?.isRetailer);
        const normalizedShopName = isRetailer ? String(retailerDetails?.shopName || '').trim() : '';
        const normalizedGstNumber = isRetailer
            ? String(retailerDetails?.gstNumber || '').replace(/\s+/g, '').toUpperCase()
            : '';

        if (isRetailer) {
            if (!normalizedShopName || !normalizedGstNumber) {
                return res.status(400).json({ message: 'Shop name and GST number are required for retailer orders' });
            }
            if (normalizedGstNumber.length !== 15) {
                return res.status(400).json({ message: 'Invalid GST number' });
            }
        }

        // Generate Unique Human-Readable Order ID
        const generateDisplayId = () => {
            const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous 0, O, 1, I
            let result = 'ORD-';
            for (let i = 0; i < 6; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            return result;
        };

        let displayId = generateDisplayId();
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 10) {
            const existing = await Order.findOne({ displayId });
            if (!existing) {
                isUnique = true;
            } else {
                displayId = generateDisplayId();
                attempts++;
            }
        }

        const resolvedOrderItems = [];

        // 1. Initial Stock Validation (Pre-creation)
        for (const item of orderItems) {
            const product = productsById.get(Number(item.product || item._id));
            if (!product) {
                return res.status(404).json({ message: `Product not found: ${item.name}` });
            }

            const { normalizedVariant, matchingSku } = validateAndResolveOrderItemVariant(product, item);

            // Check Variant Stock if applicable
            if (matchingSku) {
                const purchaseLimit = getEffectivePurchaseLimit(product, matchingSku.stock);

                if (purchaseLimit < item.qty) {
                    return res.status(400).json({ 
                        message: purchaseLimit <= 0
                            ? `Insufficient stock for ${item.name} (${Object.values(normalizedVariant).join(', ')})`
                            : `Maximum allowed quantity for ${item.name} is ${purchaseLimit}`,
                        available: purchaseLimit
                    });
                }
            } else if (getEffectivePurchaseLimit(product, product.stock) < item.qty) {
                // Check Overall Stock
                const purchaseLimit = getEffectivePurchaseLimit(product, product.stock);
                return res.status(400).json({ 
                    message: purchaseLimit <= 0
                        ? `Insufficient stock for ${item.name}`
                        : `Maximum allowed quantity for ${item.name} is ${purchaseLimit}`,
                    available: purchaseLimit
                });
            }

            resolvedOrderItems.push({
                ...item,
                variant: Object.keys(normalizedVariant).length > 0 ? normalizedVariant : undefined,
                product: item.product || item._id
            });
        }

        const shouldClaimPayment = isOnlinePayment || (codAdvancedActive && Math.min(totalPrice, settings.codAdvancedPaymentAmount) > 0);
        if (shouldClaimPayment) {
            const claimMethod = codAdvancedActive ? 'ONLINE' : paymentMethod;
            const paymentClaimResult = await claimOnlinePayment(claimMethod, verifiedPayment.paymentResult);
            claimedPayment = paymentClaimResult.claim;

            if (!paymentClaimResult.claimed) {
                const claimedExistingOrder = await findExistingOnlineOrder(claimMethod, verifiedPayment.paymentResult);
                if (claimedExistingOrder) {
                    return res.status(200).json(claimedExistingOrder);
                }

                return res.status(409).json({
                    message: 'This payment is already being processed. Please refresh and check your orders.'
                });
            }
        }

        const invoiceNumber = await reserveNextInvoiceNumber();
        const expectedCodAdvancedAmount = codAdvancedActive ? Math.min(totalPrice, settings.codAdvancedPaymentAmount) : 0;
        const normalizedReferralCode = normalizeReferralCode(referral?.code);
        let resolvedReferral = null;

        if (normalizedReferralCode) {
            const agent = await Agent.findOne({
                referralCode: normalizedReferralCode,
                isActive: true
            }).lean();

            if (!agent) {
                return res.status(400).json({ message: 'Invalid or inactive referral code' });
            }

            const commissionPercent = Math.max(0, Number(agent.commissionPercent) || 0);
            const referralBaseAmount = Math.max(0, Number(itemsPrice) || 0);
            const commissionAmount = Number(((referralBaseAmount * commissionPercent) / 100).toFixed(2));

            resolvedReferral = {
                code: agent.referralCode,
                agent: agent._id,
                agentName: agent.name,
                commissionPercent,
                commissionAmount
            };
        }

        const order = new Order({
            displayId,
            invoiceNumber,
            transactionId: verifiedPayment.paymentResult?.razorpay_payment_id || verifiedPayment.paymentResult?.id || null,
            orderItems: resolvedOrderItems,
            user: req.user._id,
            shippingAddress,
            retailerDetails: {
                isRetailer,
                shopName: normalizedShopName,
                gstNumber: normalizedGstNumber
            },
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
            coupon: resolvedCoupon,
            referral: resolvedReferral,
            isPaid: codAdvancedActive ? false : verifiedPayment.isPaid,
            paidAt: codAdvancedActive ? null : verifiedPayment.paidAt,
            isCodAdvancedPaid: codAdvancedActive && expectedCodAdvancedAmount > 0,
            codAdvancedAmount: expectedCodAdvancedAmount,
            remainingCodBalance: codAdvancedActive ? Math.max(0, totalPrice - expectedCodAdvancedAmount) : totalPrice,
            paymentResult: verifiedPayment.paymentResult
        });

        const createdOrder = await order.save();
        createdOrderId = createdOrder._id;

        if (claimedPayment?._id) {
            await PaymentClaim.findByIdAndUpdate(claimedPayment._id, {
                $set: { order: createdOrder._id }
            });
        }

        // Reduce stock concurrently; all items were validated before order creation.
        const stockResults = await Promise.all(createdOrder.orderItems.map(async (item) => {
            const product = productsById.get(Number(item.product));
            if (product) {
                const update = { $inc: { stock: -item.qty } };
                // Guard so a concurrent order can never push stock below zero.
                const filter = { _id: product._id, stock: { $gte: item.qty } };

                // If variant exists, find its index for atomic array update
                if (item.variant && Object.keys(item.variant).length > 0) {
                    const skuIndex = product.skus.findIndex(s => {
                        const comb = s.combination instanceof Map ? Object.fromEntries(s.combination) : s.combination;
                        const itemKeys = Object.keys(item.variant);
                        const combKeys = Object.keys(comb);
                        if (itemKeys.length !== combKeys.length) return false;
                        return itemKeys.every(key => String(item.variant[key]) === String(comb[key]));
                    });

                    if (skuIndex !== -1) {
                        update.$inc[`skus.${skuIndex}.stock`] = -item.qty;
                        filter[`skus.${skuIndex}.stock`] = { $gte: item.qty };
                    }
                }

                // Atomic conditional update: null means someone else took the stock first.
                const updatedProduct = await Product.findOneAndUpdate(
                    filter,
                    update,
                    { new: true }
                );

                if (!updatedProduct) {
                    return { ok: false, item, alerts: [] };
                }

                const alerts = [];
                {
                    if (updatedProduct.stock <= 5) {
                        alerts.push({
                            type: 'stock',
                            title: 'Low Stock Alert',
                            message: `Product "${updatedProduct.name}" is running low on stock (${updatedProduct.stock} remaining).`,
                            relatedId: updatedProduct._id
                        });
                    }

                    // Variant Low Stock Alert (Check updated SKU stock)
                    if (item.variant && Object.keys(item.variant).length > 0) {
                         const updatedSku = updatedProduct.skus.find(s => {
                            const comb = s.combination instanceof Map ? Object.fromEntries(s.combination) : s.combination;
                            const itemKeys = Object.keys(item.variant);
                            return itemKeys.every(key => String(item.variant[key]) === String(comb[key]));
                        });
                        if (updatedSku && updatedSku.stock <= 5) {
                            alerts.push({
                                type: 'stock',
                                title: 'Low Stock Alert (Variant)',
                                message: `Product "${updatedProduct.name}" variant has low stock (${updatedSku.stock} remaining).`,
                                relatedId: updatedProduct._id
                            });
                        }
                    }
                }
                return { ok: true, item, alerts };
            }
            return { ok: true, item, alerts: [] };
        }));

        const failed = stockResults.filter((r) => !r.ok);
        if (failed.length) {
            // Roll back the items that did succeed, then drop the order.
            await restoreOrderStock({ orderItems: stockResults.filter((r) => r.ok).map((r) => r.item) });
            await Order.findByIdAndDelete(createdOrder._id).catch(() => {});
            if (claimedPayment?._id) {
                await PaymentClaim.findByIdAndUpdate(claimedPayment._id, { $unset: { order: 1 } }).catch(() => {});
            }
            return res.status(409).json({
                message: `Insufficient stock for ${failed.map((r) => r.item.name).join(', ')}. Please try again.`
            });
        }

        const notifications = stockResults.flatMap((r) => r.alerts);
        notifications.push({
            type: 'order',
            title: 'New Order Received',
            message: `Order #${createdOrder._id.toString().slice(-6).toUpperCase()} placed by ${req.user.name} for ₹${totalPrice}`,
            relatedId: createdOrder._id
        });

        res.status(201).json(createdOrder);

        // Notifications are best-effort side effects and must not hold checkout open.
        Notification.insertMany(notifications).catch((notificationError) => {
            console.error(`[${req.requestId || 'no-request-id'}] Order notification error:`, notificationError);
        });
    } catch (error) {
        if (claimedPayment?._id && !createdOrderId) {
            await PaymentClaim.findByIdAndDelete(claimedPayment._id).catch(() => {});
        }
        console.error('Order creation error:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Order creation failed' });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        const syncedOrders = await mapWithConcurrency(orders, (order) => syncOrderPaymentFromGateway(order), ORDER_SYNC_CONCURRENCY);
        const fulfillmentReadyOrders = await mapWithConcurrency(syncedOrders, (order) => syncOrderFulfillmentStatus(order), ORDER_SYNC_CONCURRENCY);
        const auditedOrders = await annotateDuplicatePayments(fulfillmentReadyOrders);
        res.json(auditedOrders);
    } catch (error) {
        console.error('Get my orders error:', error);
        res.status(500).json({ message: error.message });
    }
};

const syncOrderFulfillmentStatus = async (order) => {
    if (!order) return order;

    // If order is already in a final state, do not query tracking API
    if (order.isDelivered || ['Delivered', 'Cancelled'].includes(order.status)) {
        return order;
    }

    const provider = getFulfillmentMode(order);
    if (!['delhivery', 'ekart'].includes(provider)) {
        return order;
    }

    const trackingIdentifier = getProviderTrackingIdentifier(order, provider);
    if (!trackingIdentifier) {
        return order;
    }

    // Rate-limit sync to avoid overloading courier APIs (e.g. max once per 5 minutes)
    const lastSyncedAt = provider === 'ekart' ? order.ekart?.syncedAt : order.delhivery?.syncedAt;
    if (lastSyncedAt && (Date.now() - new Date(lastSyncedAt).getTime() < 5 * 60 * 1000)) {
        return order;
    }

    try {
        const tracking = await fetchTrackingForProvider(order, provider);
        if (tracking && tracking.mappedCurrentStep) {
            const step = tracking.mappedCurrentStep;
            let statusChanged = false;

            if (step === 'Delivered' && order.status !== 'Delivered') {
                order.isDelivered = true;
                order.deliveredAt = tracking.lastUpdatedAt ? new Date(tracking.lastUpdatedAt) : new Date();
                order.status = 'Delivered';
                statusChanged = true;
            } else if (step === 'Cancelled' && order.status !== 'Cancelled') {
                // Do NOT cancel the order here. This sync runs on admin page
                // loads, so a courier reporting Cancelled would silently void a
                // live order and restore its stock with nobody in the loop.
                // Flag it instead and let an admin confirm.
                if (!order.courierCancellation?.reportedAt) {
                    order.courierCancellation = {
                        provider: getFulfillmentMode(order),
                        rawStatus: String(tracking.currentStatus || step),
                        reportedAt: new Date(),
                        acknowledged: false
                    };
                    statusChanged = true;
                    console.warn(`[courier-cancel] ${order.displayId || order._id} reported Cancelled by ${getFulfillmentMode(order)} — flagged for review, order left as ${order.status}`);
                }
            } else if (['Dispatched', 'Out for Delivery'].includes(step)) {
                if (order.status !== step) {
                    order.status = step;
                    statusChanged = true;
                }
            }

            // Always update syncedAt on successful tracking check to enforce rate limit
            if (provider === 'ekart' && order.ekart) {
                order.ekart.syncedAt = new Date();
                statusChanged = true;
            } else if (provider === 'delhivery' && order.delhivery) {
                order.delhivery.syncedAt = new Date();
                statusChanged = true;
            }

            if (statusChanged) {
                await order.save();
            }
        }
    } catch (error) {
        console.error(`Fulfillment status sync failed for order ${order._id} (provider: ${provider}):`, error);
        // Silently catch and log so order retrieval is not broken
    }

    return order;
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        
        if (order) {
            // Authorize against the raw stored owner id before attempting population.
            // This keeps ownership checks working even for special/bypass users
            // whose referenced user document may not exist in the Users collection.
            const { orderUserId, currentUserId, isAdmin, isAllowed } = isOrderAccessibleByUser(order, req.user);

            console.log(`Checking Order Auth: OrderOwner=${orderUserId}, RequestUser=${currentUserId}, isAdmin=${isAdmin}`);

            // Check if it's the owner or an admin
            if (isAllowed) {
                const shouldEnsureInvoice = String(req.query.ensureInvoice ?? 'true') !== 'false';
                const shouldSyncPayment = String(req.query.syncPayment ?? 'true') !== 'false';
                const shouldSyncFulfillment = String(req.query.syncFulfillment ?? 'true') === 'true';
                const shouldIncludePaymentAudit = String(req.query.includePaymentAudit ?? 'true') === 'true';

                if (shouldEnsureInvoice) {
                    await ensureOrderInvoiceNumber(order);
                }

                const syncedOrder = shouldSyncPayment
                    ? await syncOrderPaymentFromGateway(order)
                    : order;
                const fulfillmentReadyOrder = shouldSyncFulfillment
                    ? await syncOrderFulfillmentStatus(syncedOrder)
                    : syncedOrder;
                const [finalOrder] = shouldIncludePaymentAudit
                    ? await annotateDuplicatePayments([fulfillmentReadyOrder])
                    : [fulfillmentReadyOrder];
                await finalOrder.populate('user', 'name email phone');
                res.json(finalOrder);
            } else {
                res.status(401).json({ 
                    message: 'Not authorized to view this order',
                    details: `Current: ${currentUserId}, Owner: ${orderUserId}`
                });
            }
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        console.error(`Get order by ID error [ID: ${req.params.id}]:`, error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get live Delhivery tracking for an order
// @route   GET /api/orders/:id/delhivery-tracking
// @access  Private
export const getOrderDelhiveryTracking = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const { isAllowed } = isOrderAccessibleByUser(order, req.user);
        if (!isAllowed) {
            return res.status(401).json({ message: 'Not authorized to view this order tracking' });
        }

        if (!order.delhivery?.waybill) {
            return res.status(400).json({ message: 'Delhivery shipment has not been created for this order yet.' });
        }

        const tracking = await fetchDelhiveryTracking(order);

        return res.json({
            orderId: order._id,
            displayId: order.displayId,
            status: order.status,
            waybill: order.delhivery.waybill,
            tracking
        });
    } catch (error) {
        console.error(`Get order Delhivery tracking error [ID: ${req.params.id}]:`, error);
        return res.status(500).json({ message: error.message || 'Failed to fetch Delhivery tracking' });
    }
};

// @desc    Get live shipping tracking for an order
// @route   GET /api/orders/:id/shipping-tracking
// @access  Private
export const getOrderShippingTracking = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const { isAllowed } = isOrderAccessibleByUser(order, req.user);
        if (!isAllowed) {
            return res.status(401).json({ message: 'Not authorized to view this order tracking' });
        }

        const provider = getFulfillmentMode(order);
        if (!['delhivery', 'ekart'].includes(provider)) {
            return res.status(400).json({ message: 'Tracking is available only after assigning Delhivery or Ekart.' });
        }

        const trackingIdentifier = getProviderTrackingIdentifier(order, provider);
        if (!trackingIdentifier) {
            return res.status(400).json({ message: `${provider === 'delhivery' ? 'Delhivery waybill' : 'Ekart tracking number'} has not been created for this order yet.` });
        }

        const tracking = await fetchTrackingForProvider(order, provider);

        // Sync fulfillment status on the fly with retrieved tracking
        if (tracking && tracking.mappedCurrentStep) {
            const step = tracking.mappedCurrentStep;
            let statusChanged = false;

            if (step === 'Delivered' && order.status !== 'Delivered') {
                order.isDelivered = true;
                order.deliveredAt = tracking.lastUpdatedAt ? new Date(tracking.lastUpdatedAt) : new Date();
                order.status = 'Delivered';
                statusChanged = true;
            } else if (step === 'Cancelled' && order.status !== 'Cancelled') {
                // Do NOT cancel the order here. This sync runs on admin page
                // loads, so a courier reporting Cancelled would silently void a
                // live order and restore its stock with nobody in the loop.
                // Flag it instead and let an admin confirm.
                if (!order.courierCancellation?.reportedAt) {
                    order.courierCancellation = {
                        provider: getFulfillmentMode(order),
                        rawStatus: String(tracking.currentStatus || step),
                        reportedAt: new Date(),
                        acknowledged: false
                    };
                    statusChanged = true;
                    console.warn(`[courier-cancel] ${order.displayId || order._id} reported Cancelled by ${getFulfillmentMode(order)} — flagged for review, order left as ${order.status}`);
                }
            } else if (['Dispatched', 'Out for Delivery'].includes(step)) {
                if (order.status !== step) {
                    order.status = step;
                    statusChanged = true;
                }
            }

            // Always update syncedAt when we query tracking explicitly
            if (provider === 'ekart' && order.ekart) {
                order.ekart.syncedAt = new Date();
                statusChanged = true;
            } else if (provider === 'delhivery' && order.delhivery) {
                order.delhivery.syncedAt = new Date();
                statusChanged = true;
            }

            if (statusChanged) {
                await order.save();
            }
        }

        return res.json({
            orderId: order._id,
            displayId: order.displayId,
            status: order.status,
            provider,
            trackingIdentifier,
            tracking
        });
    } catch (error) {
        console.error(`Get order shipping tracking error [ID: ${req.params.id}]:`, error);
        return res.status(500).json({ message: error.message || 'Failed to fetch shipping tracking' });
    }
};

// @desc    Assign order fulfillment mode
// @route   PUT /api/orders/:id/fulfillment
// @access  Private/Admin
export const assignOrderFulfillment = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        const requestedMode = String(req.body?.mode || '').trim().toLowerCase();

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!['manual', 'delhivery', 'ekart'].includes(requestedMode)) {
            return res.status(400).json({ message: 'Invalid fulfillment mode' });
        }

        const currentMode = getFulfillmentMode(order);
        if (currentMode === requestedMode) {
            await order.populate('user', 'name email phone');
            return res.json(order);
        }

        order.fulfillment = {
            ...order.fulfillment,
            mode: requestedMode,
            assignedAt: new Date(),
            assignedBy: req.user?._id || null
        };

        if (['delhivery', 'ekart'].includes(requestedMode)) {
            if (!getProviderTrackingIdentifier(order, requestedMode)) {
                try {
                    await createShipmentForProvider(order, requestedMode);
                } catch (error) {
                    setProviderCreationError(order, requestedMode, error.message || `Failed to create ${requestedMode} shipment`);
                    await order.save();
                    return res.status(400).json({
                        message: error.message || `Failed to create ${requestedMode} shipment`
                    });
                }
            }

            if (String(order.status || '').trim() === 'Pending') {
                order.status = 'Confirmed';
            }
        } else {
            clearInactiveProviderErrors(order, 'manual');
        }

        const updatedOrder = await order.save();
        await updatedOrder.populate('user', 'name email phone');
        return res.json(updatedOrder);
    } catch (error) {
        console.error('Assign order fulfillment error:', error);
        return res.status(500).json({ message: error.message || 'Failed to assign fulfillment mode' });
    }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = async (req, res) => {
    try {
        const { pageNumber, limit, search, status, user, userId, startDate, endDate } = req.query;
        const shouldSyncPayments = String(req.query.syncPayments || 'false') !== 'false';
        const shouldSyncFulfillment = String(req.query.syncFulfillment || 'false') === 'true';
        const shouldAuditPayments = String(req.query.includePaymentAudit || 'false') === 'true';
        const filter = buildOrderListFilter({ search, status, user, userId, startDate, endDate });
        const hasPagination = pageNumber !== undefined || limit !== undefined;
        const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
        const page = Math.max(1, Number(pageNumber) || 1);

        let query = Order.find(filter)
            .select(ORDER_LIST_SELECT)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 });

        if (hasPagination) {
            query = query.limit(pageSize).skip(pageSize * (page - 1));
        }

        if (!shouldSyncFulfillment) {
            query = query.lean();
        }

        const [count, rawOrders] = await Promise.all([
            hasPagination ? Order.countDocuments(filter) : Promise.resolve(null),
            query
        ]);

        const syncedOrders = shouldSyncPayments
            ? await mapWithConcurrency(rawOrders, (order) => syncOrderPaymentFromGateway(order), ORDER_SYNC_CONCURRENCY)
            : rawOrders;
        const fulfillmentReadyOrders = shouldSyncFulfillment
            ? await mapWithConcurrency(syncedOrders, (order) => syncOrderFulfillmentStatus(order), ORDER_SYNC_CONCURRENCY)
            : syncedOrders;
        const finalOrders = shouldAuditPayments
            ? await annotateDuplicatePayments(fulfillmentReadyOrders)
            : fulfillmentReadyOrders;

        if (hasPagination) {
            return res.json({
                orders: finalOrders,
                page,
                pages: Math.max(1, Math.ceil((count || 0) / pageSize)),
                total: count || 0,
                limit: pageSize
            });
        }

        res.json(finalOrders);
    } catch (error) {
        console.error('Get all orders error:', error);
        res.status(500).json({ message: error.message });
    }
};

const CSV_TEXT_MARKER = /^="[A-Za-z0-9-]+"$/;

const escapeCsvCell = (value) => {
    if (value === null || value === undefined) return '';

    let stringValue = String(value).replace(/\r?\n/g, ' ');

    // Neutralise CSV formula injection: a cell opening with one of these is
    // executed by Excel/Sheets, and product names and addresses are user input.
    // The ="..." form emitted by asCsvText below is ours and stays as-is.
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(stringValue) && !CSV_TEXT_MARKER.test(stringValue)) {
        stringValue = `'${stringValue}`;
    }

    return /[",]/.test(stringValue)
        ? `"${stringValue.replace(/"/g, '""')}"`
        : stringValue;
};

// Long digit strings (IMEI, serials, waybills, phone, account numbers) are
// parsed as numbers by Excel and rendered as 8.61234E+14. Marking them as
// text keeps every digit. Only applied to safe [A-Za-z0-9-] values so this
// never becomes a formula-injection vector.
const asCsvText = (value) => {
    const stringValue = String(value ?? '').trim();
    if (!stringValue || !/^[A-Za-z0-9-]+$/.test(stringValue)) return stringValue;
    return `="${stringValue}"`;
};

// One row per order item so Variant / Serial / IMEI get real columns.
const formatOrderExportRows = (order) => {
    const items = Array.isArray(order?.orderItems) ? order.orderItems : [];
    const fulfillmentMode = getFulfillmentMode(order);
    const trackingNumber = order?.delhivery?.waybill || order?.ekart?.trackingNumber || '';
    const isPaid = Boolean(order?.isPaid) || order?.paymentResult?.status === 'paid' || Boolean(order?.paidAt);
    const retailerDetails = order?.shippingAddress?.retailerDetails || order?.retailerDetails || {};
    const isRetailer = Boolean(retailerDetails?.isRetailer);
    const retailerShopName = isRetailer ? String(retailerDetails?.shopName || '').trim() : '';
    const retailerGstNumber = isRetailer
        ? String(retailerDetails?.gstNumber || '').replace(/\s+/g, '').toUpperCase()
        : '';

    const orderColumns = [
        order?._id || '',
        order?.displayId || '',
        order?.invoiceNumber || '',
        order?.createdAt ? new Date(order.createdAt).toISOString() : '',
        order?.user?.name || order?.shippingAddress?.name || '',
        order?.user?.email || order?.shippingAddress?.email || '',
        asCsvText(order?.user?.phone || order?.shippingAddress?.phone || ''),
        order?.status || '',
        order?.paymentMethod || '',
        order?.paymentResult?.status || '',
        isPaid ? 'Yes' : 'No',
        order?.paidAt ? new Date(order.paidAt).toISOString() : '',
        order?.deliveredAt ? new Date(order.deliveredAt).toISOString() : ''
    ];

    const orderTotals = [
        Number(order?.itemsPrice || 0),
        Number(order?.shippingPrice || 0),
        Number(order?.taxPrice || 0),
        order?.coupon?.code || '',
        Number(order?.coupon?.discount || 0),
        order?.referral?.code || '',
        order?.referral?.agentName || '',
        Number(order?.referral?.commissionAmount || 0),
        Number(order?.totalPrice || 0),
        fulfillmentMode,
        asCsvText(trackingNumber),
        isRetailer ? 'Yes' : 'No',
        retailerShopName,
        asCsvText(retailerGstNumber),
        order?.shippingAddress?.name || '',
        order?.shippingAddress?.street || '',
        order?.shippingAddress?.city || '',
        order?.shippingAddress?.state || '',
        asCsvText(order?.shippingAddress?.postalCode || ''),
        order?.shippingAddress?.country || '',
        asCsvText(order?.transactionId || order?.paymentResult?.id || '')
    ];

    const rowsForItems = (items.length ? items : [null]).map((item) => {
        const variant = item?.variant && typeof item.variant === 'object' && !Array.isArray(item.variant)
            ? item.variant
            : {};
        const variantText = Object.entries(variant)
            .filter(([key, value]) => key && value)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        const serialType = String(item?.serialType || '').trim();

        return [
            ...orderColumns,
            item?.name || '',
            item?.product ?? '',
            variantText,
            Number(item?.qty) || 0,
            Number(item?.price) || 0,
            serialType === 'IMEI' ? '' : asCsvText(item?.serialNumber || ''),
            serialType === 'IMEI' ? asCsvText(item?.serialNumber || '') : '',
            ...orderTotals
        ];
    });

    return rowsForItems;
};

// @desc    Export orders as CSV
// @route   GET /api/orders/export
// @access  Private/Admin
export const exportOrdersCsv = async (req, res) => {
    let orderCursor = null;
    try {
        const { pageNumber, limit, search, status, user, userId, startDate, endDate } = req.query;
        const filter = buildOrderListFilter({ search, status, user, userId, startDate, endDate });
        const hasPagination = pageNumber !== undefined || limit !== undefined;
        const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
        const page = Math.max(1, Number(pageNumber) || 1);

        const headers = [
            'Order ID',
            'Display ID',
            'Invoice Number',
            'Order Date',
            'Customer Name',
            'Customer Email',
            'Customer Phone',
            'Status',
            'Payment Method',
            'Payment Status',
            'Is Paid',
            'Paid At',
            'Delivered At',
            'Product Name',
            'Product ID',
            'Variant',
            'Quantity',
            'Unit Price',
            'Serial Number',
            'IMEI Number',
            'Items Price',
            'Shipping Price',
            'Tax Price',
            'Coupon Code',
            'Coupon Discount',
            'Referral Code',
            'Referral Agent',
            'Referral Commission',
            'Total Amount',
            'Fulfillment Mode',
            'Tracking/Waybill Number',
            'Is Retailer',
            'Shop Name',
            'GST Number',
            'Shipping Name',
            'Shipping Street',
            'Shipping City',
            'Shipping State',
            'Shipping Pincode',
            'Shipping Country',
            'Transaction ID'
        ];

        const fileDate = new Date().toISOString().split('T')[0];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="orders_export_${fileDate}.csv"`);

        res.flushHeaders?.();
        res.write(`\uFEFF${headers.map(escapeCsvCell).join(',')}\n`);

        let exportQuery = Order.find(filter)
            // Export needs payment/delivery/coupon fields the list view does not select.
            .select(`${ORDER_LIST_SELECT} isPaid paidAt isDelivered deliveredAt coupon`)
            .populate('user', 'name email phone')
            .sort({ createdAt: -1 })
            .lean();

        if (hasPagination) {
            exportQuery = exportQuery.limit(pageSize).skip(pageSize * (page - 1));
        }

        orderCursor = exportQuery.cursor();

        for await (const order of orderCursor) {
            if (res.destroyed || req.destroyed) {
                break;
            }
            for (const row of formatOrderExportRows(order)) {
                res.write(`${row.map(escapeCsvCell).join(',')}\n`);
            }
        }

        res.end();
    } catch (error) {
        console.error('Export orders CSV error:', error);
        if (orderCursor) {
            try {
                await orderCursor.close();
            } catch {
                // Ignore cursor close errors after primary failure.
            }
        }

        if (!res.headersSent) {
            res.status(500).json({ message: error.message || 'Failed to export orders' });
            return;
        }

        if (!res.destroyed) {
            res.end();
        }
    }
};

// @desc    Update order to delivered
// @route   PUT /api/orders/:id/deliver
// @access  Private/Admin
export const updateOrderToDelivered = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (order) {
            order.isDelivered = true;
            order.deliveredAt = Date.now();
            order.status = 'Delivered'; // Syncing status field

            const updatedOrder = await order.save();
            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        console.error('Update to delivered error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order status (general)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const applyOrderStatusUpdate = async (order, status, serialNumbers) => {
    const nextStatus = String(status || '').trim();
    const fulfillmentMode = getFulfillmentMode(order);
    const resolvedFulfillmentMode = fulfillmentMode === 'unassigned' ? 'manual' : fulfillmentMode;

    if (!nextStatus) {
        const error = new Error('Status is required');
        error.statusCode = 400;
        throw error;
    }

    if (resolvedFulfillmentMode === 'manual' && !MANUAL_TRACKING_STATUSES.has(nextStatus)) {
        const error = new Error('Invalid manual fulfillment status');
        error.statusCode = 400;
        throw error;
    }

    if (fulfillmentMode === 'unassigned' && resolvedFulfillmentMode === 'manual') {
        order.fulfillment = {
            ...order.fulfillment,
            mode: 'manual',
            assignedAt: order.fulfillment?.assignedAt || new Date(),
            assignedBy: order.fulfillment?.assignedBy || null
        };
    }

    if (nextStatus === 'Cancelled') {
        if (order.isDelivered || order.deliveredAt || order.status === 'Delivered') {
            const error = new Error('Delivered order cannot be cancelled');
            error.statusCode = 400;
            throw error;
        }

        if (['delhivery', 'ekart'].includes(resolvedFulfillmentMode) && getProviderTrackingIdentifier(order, resolvedFulfillmentMode)) {
            try {
                await cancelShipmentForProvider(order, resolvedFulfillmentMode);
            } catch (error) {
                setProviderCancellationError(order, resolvedFulfillmentMode, error.message || `Failed to cancel ${resolvedFulfillmentMode} shipment`);
                await order.save();
                error.statusCode = 400;
                throw error;
            }
        }

        if (order.status !== 'Cancelled') {
            await restoreOrderStock(order);
        }
    }

    order.status = nextStatus;
    if (nextStatus === 'Delivered') {
        order.isDelivered = true;
        order.deliveredAt = Date.now();
    }

    // serialNumbers expected to be array of objects: { itemId: "...", serial: "...", type: "..." }
    if (serialNumbers && Array.isArray(serialNumbers) && serialNumbers.length > 0) {
        serialNumbers.forEach(sItem => {
            const item = order.orderItems.find(i => i._id.toString() === sItem.itemId);
            if (item) {
                item.serialNumber = sItem.serial;
                item.serialType = sItem.type || 'Serial Number';
            }
        });
    }

    if (nextStatus === 'Cancelled') {
        await refundCancelledRazorpayOrder(order, 'Order cancelled before delivery');
    }

    const shouldCreateProviderShipment =
        ['delhivery', 'ekart'].includes(resolvedFulfillmentMode) &&
        PROVIDER_SYNC_TRIGGER_STATUSES.has(nextStatus) &&
        !getProviderTrackingIdentifier(order, resolvedFulfillmentMode);

    if (shouldCreateProviderShipment) {
        try {
            await createShipmentForProvider(order, resolvedFulfillmentMode);
        } catch (error) {
            setProviderCreationError(order, resolvedFulfillmentMode, error.message || `Failed to create ${resolvedFulfillmentMode} shipment`);
            order.status = 'Pending';
            await order.save();
            error.statusCode = 400;
            throw error;
        }
    }

    const updatedOrder = await order.save();
    await updatedOrder.populate('user', 'name email phone');
    return updatedOrder;
};

export const updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        const { status, serialNumbers } = req.body;

        if (order) {
            const updatedOrder = await applyOrderStatusUpdate(order, status, serialNumbers);
            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// @desc    Update multiple order statuses using the same source-of-truth status path
// @route   PUT /api/orders/bulk-status
// @access  Private/Admin
export const updateBulkOrderStatus = async (req, res) => {
    try {
        const { orderIds, status } = req.body;
        const normalizedIds = Array.isArray(orderIds)
            ? [...new Set(orderIds.map((id) => String(id || '').trim()).filter(Boolean))]
            : [];

        if (!normalizedIds.length) {
            return res.status(400).json({ message: 'Select at least one order' });
        }

        if (!String(status || '').trim()) {
            return res.status(400).json({ message: 'Status is required' });
        }

        const updatedOrders = [];
        const failedOrders = [];

        for (const orderId of normalizedIds) {
            try {
                const order = await Order.findById(orderId);

                if (!order) {
                    failedOrders.push({ id: orderId, message: 'Order not found' });
                    continue;
                }

                const updatedOrder = await applyOrderStatusUpdate(order, status);
                updatedOrders.push(updatedOrder);
            } catch (error) {
                failedOrders.push({
                    id: orderId,
                    message: error.message || 'Failed to update order status'
                });
            }
        }

        res.json({
            message: `${updatedOrders.length} order${updatedOrders.length === 1 ? '' : 's'} updated`,
            updatedOrders,
            failedOrders
        });
    } catch (error) {
        console.error('Bulk update order status error:', error);
        res.status(500).json({ message: error.message });
    }
};


export const __testables = { escapeCsvCell, asCsvText };
