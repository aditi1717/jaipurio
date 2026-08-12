import Return from '../models/Return.js';
import Order from '../models/Order.js';
import { createDelhiveryReversePickup } from '../utils/delhiveryService.js';
import Notification from '../models/Notification.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import { refundCancelledRazorpayOrder, restoreOrderStock } from '../utils/orderCancellation.js';

const RETURN_WINDOW_DAYS = 7;
const NON_REJECTED_RETURN_STATUSES = new Set([
    'Pending',
    'Approved',
    'Pickup Scheduled',
    'Received at Warehouse',
    'Refund Initiated',
    'Replacement Dispatched',
    'Completed'
]);

const replacementUsesRefundFlow = (returnRequest) => {
    if (String(returnRequest?.type || '').trim() !== 'Replacement') return false;
    const timeline = Array.isArray(returnRequest?.timeline) ? returnRequest.timeline : [];
    return timeline.some((entry) => String(entry?.status || '').trim() === 'Refund Initiated');
};

const getNormalizedQuantity = (value) => Math.max(1, Number.parseInt(value, 10) || 1);
const normalizeVariant = (value) => (value && typeof value === 'object' ? value : {});
const isSameVariant = (first = {}, second = {}) => JSON.stringify(first || {}) === JSON.stringify(second || {});

const doesReturnBelongToOrderItem = (returnRequest, orderItem) => {
    if (!returnRequest || !orderItem) return false;

    if (returnRequest.orderItemId) {
        return String(returnRequest.orderItemId) === String(orderItem?._id);
    }

    const returnProductId = returnRequest?.product?.id;
    const orderProductId = orderItem?.product;
    const sameProductId = returnProductId !== undefined && String(returnProductId) === String(orderProductId);
    const sameVariant = isSameVariant(normalizeVariant(returnRequest?.product?.variant), normalizeVariant(orderItem?.variant));
    const sameName = String(returnRequest?.product?.name || '').trim() === String(orderItem?.name || '').trim();

    return (sameProductId && sameVariant) || (sameName && sameVariant);
};

const getConsumedQuantityForOrderItem = (returnRequests = [], orderItem) =>
    returnRequests.reduce((total, returnRequest) => {
        if (returnRequest?.type === 'Cancellation') return total;
        if (!NON_REJECTED_RETURN_STATUSES.has(String(returnRequest?.status || '').trim())) return total;
        if (!doesReturnBelongToOrderItem(returnRequest, orderItem)) return total;
        return total + getNormalizedQuantity(returnRequest?.requestedQuantity);
    }, 0);

const getAggregateReturnStatusForOrderItem = (returnRequests = [], orderItem) => {
    const orderedQty = getNormalizedQuantity(orderItem?.qty || orderItem?.quantity || 1);
    let completedReturnQty = 0;
    let completedReplacementQty = 0;
    let activeReturnQty = 0;
    let activeReplacementQty = 0;
    let rejectedQty = 0;

    returnRequests.forEach((returnRequest) => {
        if (returnRequest?.type === 'Cancellation') return;
        if (!doesReturnBelongToOrderItem(returnRequest, orderItem)) return;

        const requestQty = getNormalizedQuantity(returnRequest?.requestedQuantity);
        const normalizedStatus = String(returnRequest?.status || '').trim();

        if (normalizedStatus === 'Rejected') {
            rejectedQty += requestQty;
            return;
        }

        if (normalizedStatus === 'Completed') {
            if (returnRequest.type === 'Replacement' && !replacementUsesRefundFlow(returnRequest)) completedReplacementQty += requestQty;
            else completedReturnQty += requestQty;
            return;
        }

        if (!NON_REJECTED_RETURN_STATUSES.has(normalizedStatus)) return;

        if (returnRequest.type === 'Replacement' && !replacementUsesRefundFlow(returnRequest)) activeReplacementQty += requestQty;
        else activeReturnQty += requestQty;
    });

    if (completedReturnQty >= orderedQty) return 'Returned';
    if (completedReplacementQty >= orderedQty) return 'Replaced';
    if (activeReturnQty >= orderedQty) return 'Return Requested';
    if (activeReplacementQty >= orderedQty) return 'Replacement Requested';
    if (rejectedQty > 0 && completedReturnQty === 0 && completedReplacementQty === 0 && activeReturnQty === 0 && activeReplacementQty === 0) {
        return 'Return Rejected';
    }
    return undefined;
};

const syncReturnStatusesForOrder = async (order) => {
    if (!order?._id) return;

    const returnRequests = await Return.find({
        orderId: order._id.toString(),
        type: { $ne: 'Cancellation' }
    }).lean();

    order.orderItems.forEach((item) => {
        item.status = getAggregateReturnStatusForOrderItem(returnRequests, item);
    });
};

// @desc    Create a new return request
// @route   POST /api/returns
// @access  Private
/**
 * A display name for the return record. Accounts created through OTP login have
 * no name, which is most of them, and Return.customer is required — so building
 * the record straight from req.user.name failed validation and those customers
 * could never raise a return or replacement at all. The order's shipping name
 * is the reliable source; phone and email are last resorts.
 */
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
        // Placeholder OTP emails are no better than a blank name.
        if (value && !value.endsWith('@otp.local') && !value.endsWith('@temp.local')) return value;
    }

    return 'Customer';
};

export const createReturnRequest = async (req, res) => {
    try {
        const {
            orderId,
            productId,
            orderItemId,
            reason,
            comment,
            type,
            requestedQuantity,
            images,
            googleDriveLink,
            bankDetails,
            selectedReplacementSize,
            selectedReplacementColor,
            pickupAddress
        } = req.body;
        const parseJSON = (value) => {
            if (!value) return value;
            if (typeof value === 'object') return value;
            if (typeof value === 'string') {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            }
            return value;
        };
        const parsedPickupAddressRaw = parseJSON(pickupAddress);
        const parsedPickupAddress = parsedPickupAddressRaw && typeof parsedPickupAddressRaw === 'object'
            ? parsedPickupAddressRaw
            : null;
        const parsedBankDetailsRaw = parseJSON(bankDetails);
        const parsedBankDetails = parsedBankDetailsRaw && typeof parsedBankDetailsRaw === 'object'
            ? {
                accountHolderName: String(parsedBankDetailsRaw.accountHolderName || '').trim(),
                accountNumber: String(parsedBankDetailsRaw.accountNumber || '').trim(),
                ifscCode: String(parsedBankDetailsRaw.ifscCode || '').trim().toUpperCase()
            }
            : null;

        const normalizedProofLink = String(googleDriveLink || '').trim();
        const proofFiles = Array.isArray(req.files) ? req.files : [];
        const uploadedProofMedia = [];

        if (normalizedProofLink && !/(drive\.google\.com|docs\.google\.com)/i.test(normalizedProofLink)) {
            return res.status(400).json({ message: 'Please provide a valid Google Drive/Docs link for proof.' });
        }

        if (parsedBankDetails) {
            const hasAnyBankField = Boolean(
                parsedBankDetails.accountHolderName || parsedBankDetails.accountNumber || parsedBankDetails.ifscCode
            );

            if (hasAnyBankField) {
                if (!parsedBankDetails.accountHolderName || !parsedBankDetails.accountNumber || !parsedBankDetails.ifscCode) {
                    return res.status(400).json({ message: 'Please provide complete bank details (name, account number, IFSC).' });
                }
                if (/\d/.test(parsedBankDetails.accountHolderName)) {
                    return res.status(400).json({ message: 'Account holder name should not contain numbers.' });
                }
                if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(parsedBankDetails.ifscCode)) {
                    return res.status(400).json({ message: 'Invalid IFSC code format.' });
                }
                if (!/^\d{9,18}$/.test(parsedBankDetails.accountNumber)) {
                    return res.status(400).json({ message: 'Invalid account number.' });
                }
            }
        }

        for (const file of proofFiles) {
            if (!file?.mimetype || (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/'))) {
                return res.status(400).json({ message: 'Only image/video files are allowed as proof.' });
            }

            if (Number(file.size || 0) > 10 * 1024 * 1024) {
                return res.status(400).json({ message: 'Each proof file must be 10MB or smaller.' });
            }
        }

        if (proofFiles.length > 0) {
            const uploadResults = await Promise.all(
                proofFiles.map((file) =>
                    uploadBufferToCloudinary(file, {
                        folder: 'ecom_uploads/returns/proofs',
                        resource_type: 'auto'
                    })
                )
            );
            uploadedProofMedia.push(...uploadResults.map((result) => result.secure_url).filter(Boolean));
        }

        const order = await Order.findOne({ _id: orderId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify user owns the order
        if (order.user && order.user.toString() !== req.user._id.toString()) {
             return res.status(401).json({ message: 'Not authorized to return items for this order' });
        }

        if (type !== 'Cancellation') {
            const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
            if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) {
                return res.status(400).json({ message: 'Return or replacement is allowed only after successful delivery.' });
            }

            const diffMs = Date.now() - deliveredAt.getTime();
            const diffDays = diffMs / (1000 * 60 * 60 * 24);
            if (diffDays > RETURN_WINDOW_DAYS) {
                return res.status(400).json({
                    message: `Return or replacement can only be requested within ${RETURN_WINDOW_DAYS} days of delivery.`
                });
            }

            const itemIndex = order.orderItems.findIndex((item) => {
                if (orderItemId && String(item._id) === String(orderItemId)) return true;
                return String(item.product) === String(productId) || String(item._id) === String(productId);
            });

            if (itemIndex === -1) {
                return res.status(404).json({ message: 'Product not found in order' });
            }

            const item = order.orderItems[itemIndex];
            const normalizedRequestedQuantity = getNormalizedQuantity(requestedQuantity);
            const allExistingReturns = await Return.find({
                orderId: order._id.toString(),
                type: { $ne: 'Cancellation' }
            }).lean();
            const itemOrderedQuantity = getNormalizedQuantity(item.qty || item.quantity || 1);
            const consumedQuantity = getConsumedQuantityForOrderItem(allExistingReturns, item);
            const maxAllowedQuantity = Math.max(0, itemOrderedQuantity - consumedQuantity);

            if (maxAllowedQuantity <= 0) {
                return res.status(400).json({
                    message: 'No quantity is currently available for return or replacement for this item.'
                });
            }

            if (normalizedRequestedQuantity > maxAllowedQuantity) {
                return res.status(400).json({ message: `You can request up to ${maxAllowedQuantity} quantity for this item.` });
            }

            const orderedVariant = normalizeVariant(item.variant);
            const orderedVariantEntries = Object.entries(orderedVariant)
                .filter(([key, value]) => key && value !== undefined && value !== null && String(value).trim() !== '');

            if (type === 'Replacement') {
                const productDoc = await Product.findOne({ id: item.product }).lean();

                if (!productDoc) {
                    return res.status(404).json({ message: 'Replacement product details not found.' });
                }

                const skuList = Array.isArray(productDoc.skus) ? productDoc.skus : [];
                const hasVariantSnapshot = orderedVariantEntries.length > 0;

                if (hasVariantSnapshot && skuList.length > 0) {
                    const exactSku = skuList.find((sku) => {
                        const combination = sku?.combination && typeof sku.combination === 'object'
                            ? sku.combination
                            : {};

                        return orderedVariantEntries.every(([key, value]) =>
                            String(combination[key] || '') === String(value)
                        );
                    });

                    if (!exactSku || Number(exactSku.stock || 0) < normalizedRequestedQuantity) {
                        return res.status(400).json({
                            message: 'Exact same product variant is unavailable for replacement right now. Please request a refund instead.'
                        });
                    }
                } else if (Number(productDoc.stock || 0) < normalizedRequestedQuantity) {
                    return res.status(400).json({
                        message: 'This product is currently out of stock for replacement. Please request a refund instead.'
                    });
                }
            }
            
            // Create Return Record
            const newReturn = new Return({
                id: `RET-${Date.now()}`,
                orderId: order._id,
                orderItemId: item._id?.toString(),
                userId: req.user._id?.toString(),
                customer: resolveCustomerName(req.user, order),
                product: {
                    id: item.product,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    variant: orderedVariant
                },
                type,
                requestedQuantity: normalizedRequestedQuantity,
                reason,
                comment,
                pickupAddress: parsedPickupAddress || {
                    name: order.shippingAddress?.name,
                    phone: order.shippingAddress?.phone,
                    address: order.shippingAddress?.street,
                    city: order.shippingAddress?.city,
                    state: order.shippingAddress?.state,
                    pincode: order.shippingAddress?.postalCode,
                    type: 'Home'
                },
                bankDetails: type === 'Return' ? (parsedBankDetails || undefined) : undefined,
                googleDriveLink: normalizedProofLink || '',
                proofMedia: uploadedProofMedia,
                images: uploadedProofMedia.length > 0 ? uploadedProofMedia : images,
                status: 'Pending',
                timeline: [{
                    status: 'Pending',
                    note: `${type} request initiated`
                }]
            });

            if (!normalizedProofLink && uploadedProofMedia.length === 0) {
                return res.status(400).json({
                    message: 'Please provide proof: either Google Drive link or image/video files (max 10MB each).'
                });
            }

            const createdReturn = await newReturn.save();

            if (type === 'Replacement' && orderedVariantEntries.length > 0) {
                const replacementVariantLabel = orderedVariantEntries
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(', ');
                createdReturn.comment = `${createdReturn.comment || ''} [Exact replacement: ${replacementVariantLabel}]`.trim();
                await createdReturn.save();
            } else if (selectedReplacementSize || selectedReplacementColor) {
                createdReturn.comment = `${createdReturn.comment || ''} [Replacement: Size ${selectedReplacementSize}, Color ${selectedReplacementColor}]`;
                await createdReturn.save();
            }

            await syncReturnStatusesForOrder(order);
            await order.save();

            // Create Return Notification
            await Notification.create({
                type: 'return',
                title: `New ${type} Request`,
                message: `${type} requested for Order #${order._id.toString().slice(-6).toUpperCase()}`,
                relatedId: createdReturn._id
            });

            return res.status(201).json(createdReturn);
        } else {
            // CANCELLATION Flow
            // Safety Check: User cancellation is allowed only while the order is pending
            const eligibleForCancellation = order.status === 'Pending';
            if (!eligibleForCancellation) {
                return res.status(400).json({ message: `Order can be cancelled only when its status is Pending. Current status: ${order.status}` });
            }

            const isOnlinePaid = Boolean(order.isPaid) && String(order.paymentMethod || '').trim().toUpperCase() !== 'COD';

            let returnStatus = 'Completed';
            let returnNote = 'Cancellation completed automatically';

            if (order.status !== 'Cancelled') {
                await restoreOrderStock(order);
                order.status = 'Cancelled';
            }

            if (isOnlinePaid) {
                const refundResult = await refundCancelledRazorpayOrder(order, 'User cancelled order before delivery');
                if (refundResult.success) {
                    returnStatus = 'Refund Initiated';
                    returnNote = 'Cancellation completed and Razorpay refund initiated automatically';
                } else {
                    returnStatus = 'Approved';
                    returnNote = `Cancellation completed but automatic refund failed: ${refundResult.error || 'Unknown error'}`;
                }
            }

            await order.save();

            const newReturn = new Return({
                id: `CAN-${Date.now()}`,
                orderId: order._id,
                userId: req.user._id?.toString(),
                customer: resolveCustomerName(req.user, order),
                product: {
                    name: 'Whole Order Cancellation',
                    image: order.orderItems[0]?.image || '', // Use first item image as placeholder
                    price: order.totalPrice
                },
                type: 'Cancellation',
                reason: reason || 'User requested cancellation',
                comment,
                status: returnStatus,
                timeline: [{
                    status: returnStatus,
                    note: returnNote
                }]
            });

            const createdReturn = await newReturn.save();

            // Create Notification
            await Notification.create({
                type: 'return',
                title: 'Order Cancelled',
                message: `Order #${order._id.toString().slice(-6).toUpperCase()} cancelled${isOnlinePaid ? ' and refund started' : ''}`,
                relatedId: createdReturn._id
            });

            return res.status(201).json(createdReturn);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};


// @desc    Get all returns (Admin)
// @route   GET /api/returns
// @access  Private/Admin
export const getReturns = async (req, res) => {
    try {
        const normalizedUserId = String(req.query.userId || '').trim();
        const returns = await Return.find({}).sort({ date: -1 }).lean();
        
        // Populate displayId manually since orderId is String
        const orderIds = returns.map(r => r.orderId);
        const orders = await Order.find({ _id: { $in: orderIds } }).select('_id displayId user');
        
        const orderMap = orders.reduce((acc, order) => {
            acc[order._id.toString()] = {
                displayId: order.displayId,
                userId: order.user ? order.user.toString() : ''
            };
            return acc;
        }, {});

        let returnsWithDisplayId = returns.map(ret => ({
            ...ret,
            orderDisplayId: orderMap[ret.orderId]?.displayId || ret.orderId,
            userId: ret.userId || orderMap[ret.orderId]?.userId || ''
        }));

        if (normalizedUserId) {
            returnsWithDisplayId = returnsWithDisplayId.filter((ret) => String(ret.userId || '') === normalizedUserId);
        }

        res.json(returnsWithDisplayId);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user returns
// @route   GET /api/returns/my-returns
// @access  Private
export const getUserReturnRequests = async (req, res) => {
    try {
        const userOrders = await Order.find({ user: req.user._id }).select('_id displayId user');
        const orderIds = userOrders.map(order => order._id.toString());
        
        const orderMap = userOrders.reduce((acc, order) => {
            acc[order._id.toString()] = {
                displayId: order.displayId,
                userId: order.user ? order.user.toString() : ''
            };
            return acc;
        }, {});

        const returns = await Return.find({ orderId: { $in: orderIds } }).sort({ date: -1 }).lean();

        const returnsWithDisplayId = returns.map(ret => ({
            ...ret,
            orderDisplayId: orderMap[ret.orderId]?.displayId || ret.orderId,
            userId: ret.userId || orderMap[ret.orderId]?.userId || ''
        }));

        res.json(returnsWithDisplayId);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update return status
// @route   PUT /api/returns/:id
// @access  Private/Admin
const RETURN_FULFILLMENT_MODES = ['unassigned', 'manual', 'ekart', 'delhivery'];

const findReturnByAnyId = async (id) => {
    if (mongoose.Types.ObjectId.isValid(id)) {
        const byObjectId = await Return.findById(id);
        if (byObjectId) return byObjectId;
    }
    return Return.findOne({ id });
};

// @desc    Assign a reverse pickup mode to a return
// @route   PUT /api/returns/:id/fulfillment
// @access  Private/Admin
export const assignReturnFulfillment = async (req, res) => {
    try {
        const mode = String(req.body?.mode || '').trim().toLowerCase();
        if (!RETURN_FULFILLMENT_MODES.includes(mode)) {
            return res.status(400).json({ message: 'Invalid pickup mode' });
        }

        const returnRequest = await findReturnByAnyId(req.params.id);
        if (!returnRequest) {
            return res.status(404).json({ message: 'Return request not found' });
        }

        let trackingNumber = String(req.body?.trackingNumber || '').trim();

        // Delhivery books reverse pickups on the same endpoint as forward
        // shipments, distinguished by payment_mode "Pickup", so it can be
        // created here. Ekart publishes no reverse contract, so its waybill is
        // still raised in their panel and pasted in.
        if (mode === 'delhivery' && !trackingNumber) {
            const order = await Order.findById(returnRequest.orderId);
            if (!order) {
                return res.status(400).json({ message: 'Original order not found for this return.' });
            }
            try {
                const { waybill } = await createDelhiveryReversePickup(returnRequest, order);
                trackingNumber = waybill;
            } catch (error) {
                return res.status(400).json({
                    message: error.message || 'Failed to book the Delhivery reverse pickup.'
                });
            }
        }

        if (mode === 'ekart' && !trackingNumber) {
            return res.status(400).json({
                message: 'Enter the Ekart reverse pickup AWB for this return.'
            });
        }

        const scheduledAt = req.body?.pickupScheduledAt ? new Date(req.body.pickupScheduledAt) : null;

        returnRequest.fulfillment = {
            mode,
            provider: mode === 'manual' || mode === 'unassigned' ? '' : mode,
            trackingNumber: mode === 'unassigned' ? '' : trackingNumber,
            pickupScheduledAt: scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : undefined,
            assignedAt: new Date(),
            assignedBy: req.user?._id || null,
            notes: String(req.body?.notes || '').trim()
        };

        // Assigning a pickup is the point the request stops being just "Approved".
        if (mode !== 'unassigned' && ['Pending', 'Approved'].includes(returnRequest.status)) {
            returnRequest.status = 'Pickup Scheduled';
            returnRequest.timeline.push({
                status: 'Pickup Scheduled',
                note: mode === 'manual'
                    ? 'Manual pickup assigned'
                    : `${mode === 'ekart' ? 'Ekart' : 'Delhivery'} reverse pickup assigned (${trackingNumber})`
            });
        }

        const updated = await returnRequest.save();
        return res.json(updated);
    } catch (error) {
        console.error('Assign return fulfillment error:', error);
        return res.status(500).json({ message: error.message || 'Failed to assign pickup' });
    }
};

export const updateReturnStatus = async (req, res) => {
    try {
        const nextStatus = String(req.body.status || '').trim();
        const note = String(req.body.note || '').trim();

        if (nextStatus === 'Rejected' && !note) {
            return res.status(400).json({ message: 'Reject reason is required.' });
        }

        let returnRequest;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
            returnRequest = await Return.findById(req.params.id);
        }
        
        if (!returnRequest) {
            returnRequest = await Return.findOne({ id: req.params.id });
        }

        if (returnRequest) {
            const order = await Order.findById(returnRequest.orderId);
            let resolvedStatus = nextStatus || returnRequest.status;
            let resolvedNote = note || `Status updated to ${resolvedStatus}`;

            if (order && returnRequest.type === 'Replacement' && nextStatus === 'Refund Initiated') {
                const refundResult = await refundCancelledRazorpayOrder(order, 'Admin initiated refund for replacement request');

                if (refundResult.attempted && !refundResult.success) {
                    return res.status(400).json({
                        message: refundResult.error || 'Unable to initiate refund for this replacement request'
                    });
                }

                if (refundResult.attempted && refundResult.success) {
                    resolvedNote = note || 'Razorpay refund initiated for replacement request';
                } else if (refundResult.reason === 'not_required') {
                    resolvedNote = note || 'Marked for manual refund processing';
                } else if (refundResult.reason === 'already_processed') {
                    resolvedNote = note || 'Refund was already processed earlier';
                }
            }

            returnRequest.status = resolvedStatus;
            returnRequest.timeline.push({
                status: resolvedStatus,
                note: resolvedNote
            });

            const updatedReturn = await returnRequest.save();

            // Sync with Order Status
            if (order) {
                if (returnRequest.type === 'Cancellation') {
                    // CANCELLATION ACTION
                    if (nextStatus === 'Approved' || nextStatus === 'Completed') {
                        // Restore Stock and Set Order to Cancelled
                        if (order.status !== 'Cancelled') {
                            order.status = 'Cancelled';
                            await restoreOrderStock(order);
                        }

                        const refundResult = await refundCancelledRazorpayOrder(order, 'Admin approved cancellation before delivery');
                        if (refundResult.attempted && refundResult.success && nextStatus !== 'Completed') {
                            returnRequest.status = 'Refund Initiated';
                            returnRequest.timeline.push({
                                status: 'Refund Initiated',
                                note: 'Razorpay refund initiated automatically'
                            });
                            await returnRequest.save();
                        }

                        await order.save();
                    } else if (nextStatus === 'Rejected') {
                        // Revert order status back to Pending/Confirmed (we'll guess Pending or just use a fixed logic)
                        // Ideally we'd store the original status, but for now we'll set back to 'Pending' or leave as is.
                        order.status = 'Pending'; 
                        await order.save();
                    }
                } else {
                    // RETURN / REPLACEMENT ACTION
                    await syncReturnStatusesForOrder(order);
                    await order.save();
                }
            }

            res.json(updatedReturn);
        } else {
            res.status(404).json({ message: 'Return request not found' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
