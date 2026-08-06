import mongoose from 'mongoose';

const orderSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
    orderItems: [
        {
            name: { type: String, required: true },
            qty: { type: Number, required: true },
            image: { type: String, required: true },
            price: { type: Number, required: true },
            variant: { type: Object }, // To store dynamic variants like { Weight: "1kg" }
            serialNumber: { type: String }, // For Admin to add Serial/IMEI when packing
            serialType: { type: String, default: 'Serial Number' }, // 'Serial Number' or 'IMEI'
            product: {
                type: Number, // Using Number ID for now
                required: true,
                ref: 'Product',
            },
            status: { type: String }, // Item-level status (e.g., 'Return Requested', 'Returned')
        },
    ],
    shippingAddress: {
        name: { type: String }, // Snapshot of user name
        email: { type: String }, // Snapshot of user email
        phone: { type: String }, // Snapshot of user phone
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, default: '' },
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
    },
    retailerDetails: {
        isRetailer: { type: Boolean, default: false },
        shopName: { type: String, default: '' },
        gstNumber: { type: String, default: '' },
    },
    paymentMethod: {
        type: String,
        required: true,
        default: 'COD',
    },
    paymentResult: {
        id: { type: String },
        status: { type: String },
        refund_status: { type: String },
        method: { type: String },
        update_time: { type: String },
        email_address: { type: String },
        razorpay_order_id: { type: String },
        razorpay_payment_id: { type: String },
        card_network: { type: String },
        card_last4: { type: String },
        card_type: { type: String },
        gateway_sync_error: { type: String }
    },
    itemsPrice: { type: Number, required: true, default: 0.0 },
    taxPrice: { type: Number, required: true, default: 0.0 },
    shippingPrice: { type: Number, required: true, default: 0.0 },
    totalPrice: { type: Number, required: true, default: 0.0 },
    coupon: {
        code: { type: String },
        discount: { type: Number, default: 0 },
        type: { type: String },
    },
    bankOffer: {
        offerName: { type: String },
        bankName: { type: String },
        discount: { type: Number, default: 0 },
        razorpayOfferId: { type: String },
    },
    referral: {
        code: { type: String, uppercase: true, trim: true },
        agent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Agent',
            default: null
        },
        agentName: { type: String, default: '' },
        commissionPercent: { type: Number, default: 0 },
        commissionAmount: { type: Number, default: 0 }
    },
    isPaid: { type: Boolean, required: true, default: false },
    paidAt: { type: Date },
    isCodAdvancedPaid: { type: Boolean, default: false },
    codAdvancedAmount: { type: Number, default: 0 },
    remainingCodBalance: { type: Number, default: 0 },
    isDelivered: { type: Boolean, required: true, default: false },
    deliveredAt: { type: Date },
    
    // OTP Delivery
    deliveryOtp: { type: String },
    deliveryOtpExpiresAt: { type: Date },
    deliveryOtpVerified: { type: Boolean, default: false },
    invoiceEnabled: { type: Boolean, default: false },
    
    // Order IDs
    displayId: { type: String, unique: true },
    invoiceNumber: { type: String, unique: true, sparse: true },
    transactionId: { type: String },
    refund: {
        status: {
            type: String,
            enum: ['not_required', 'pending', 'processed', 'failed'],
            default: undefined
        },
        refundId: { type: String },
        amount: { type: Number },
        reason: { type: String },
        initiatedAt: { type: Date },
        processedAt: { type: Date },
        error: { type: String }
    },

    // Order Status
    status: { 
        type: String, 
        default: 'Pending',
        enum: ['Pending', 'Confirmed', 'Packed', 'Dispatched', 'Out for Delivery', 'Delivered', 'Cancelled', 'Cancellation Requested']
    },
    fulfillment: {
        mode: {
            type: String,
            enum: ['unassigned', 'manual', 'delhivery', 'ekart'],
            default: 'unassigned'
        },
        assignedAt: { type: Date },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    delhivery: {
        waybill: { type: String, default: '' },
        providerOrderId: { type: String, default: '' },
        pickupLocation: { type: String, default: '' },
        syncedAt: { type: Date },
        cancelledAt: { type: Date },
        requestPayload: { type: mongoose.Schema.Types.Mixed, default: null },
        responsePayload: { type: mongoose.Schema.Types.Mixed, default: null },
        cancelResponsePayload: { type: mongoose.Schema.Types.Mixed, default: null },
        lastError: { type: String, default: '' }
    },
    ekart: {
        trackingNumber: { type: String, default: '' },
        providerOrderId: { type: String, default: '' },
        pickupLocation: { type: String, default: '' },
        syncedAt: { type: Date },
        cancelledAt: { type: Date },
        requestPayload: { type: mongoose.Schema.Types.Mixed, default: null },
        responsePayload: { type: mongoose.Schema.Types.Mixed, default: null },
        cancelResponsePayload: { type: mongoose.Schema.Types.Mixed, default: null },
        lastError: { type: String, default: '' }
    },

    // Set when a courier reports the shipment cancelled but we did not cancel it.
    // Recorded for an admin to action rather than cancelling the order outright:
    // a courier blip would otherwise silently void a live order and return stock.
    courierCancellation: {
        provider: { type: String, default: '' },
        rawStatus: { type: String, default: '' },
        reportedAt: { type: Date },
        acknowledged: { type: Boolean, default: false }
    }
}, {
    timestamps: true,
});

orderSchema.index(
    { transactionId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            transactionId: { $type: 'string', $exists: true, $ne: '' }
        }
    }
);

orderSchema.index(
    { 'paymentResult.razorpay_payment_id': 1 },
    {
        unique: true,
        partialFilterExpression: {
            'paymentResult.razorpay_payment_id': { $type: 'string', $exists: true, $ne: '' }
        }
    }
);

orderSchema.index(
    { 'paymentResult.razorpay_order_id': 1 },
    {
        unique: true,
        partialFilterExpression: {
            'paymentResult.razorpay_order_id': { $type: 'string', $exists: true, $ne: '' }
        }
    }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'shippingAddress.email': 1, createdAt: -1 });
orderSchema.index({ 'shippingAddress.phone': 1, createdAt: -1 });
orderSchema.index({ 'referral.agent': 1, createdAt: -1 });
orderSchema.index({ 'referral.code': 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
