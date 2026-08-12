import mongoose from 'mongoose';

const returnSchema = mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Custom ID string e.g., 'RET123'
    orderId: { type: String, required: true },
    orderItemId: { type: String },
    userId: { type: String },
    customer: { type: String, required: true },
    product: {
        id: { type: Number },
        name: { type: String, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        variant: { type: mongoose.Schema.Types.Mixed }
    },
    type: { 
        type: String, 
        required: true, 
        enum: ['Return', 'Replacement', 'Cancellation'] 
    },
    requestedQuantity: { type: Number, default: 1, min: 1 },
    reason: { type: String, required: true },
    comment: { type: String },
    googleDriveLink: { type: String },
    pickupAddress: {
        name: { type: String },
        phone: { type: String },
        address: { type: String },
        city: { type: String },
        state: { type: String },
        pincode: { type: String },
        type: { type: String },
    },
    bankDetails: {
        accountHolderName: { type: String },
        accountNumber: { type: String },
        ifscCode: { type: String }
    },
    proofMedia: [{ type: String }],
    images: [{ type: String }],
    status: { 
        type: String, 
        required: true, 
        default: 'Pending',
        enum: ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Refund Initiated', 'Replacement Dispatched', 'Completed', 'Rejected']
    },
    // Reverse pickup assignment, mirroring the order fulfillment flow.
    // This collects FROM the customer, the opposite direction to an order, so
    // the courier waybill is recorded rather than created through the forward
    // shipment API — that would dispatch a parcel to the customer instead.
    fulfillment: {
        mode: {
            type: String,
            enum: ['unassigned', 'manual', 'ekart', 'delhivery'],
            default: 'unassigned'
        },
        trackingNumber: { type: String, default: '' },
        provider: { type: String, default: '' },
        pickupScheduledAt: { type: Date },
        assignedAt: { type: Date },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
        notes: { type: String, default: '' }
    },

    timeline: [{
        status: { type: String, required: true },
        time: { type: Date, default: Date.now },
        note: { type: String }
    }],
    date: { type: Date, default: Date.now }
}, {
    timestamps: true,
});

returnSchema.index({ date: -1 });
returnSchema.index({ status: 1, createdAt: -1 });
returnSchema.index({ orderId: 1, date: -1 });
returnSchema.index({ userId: 1, date: -1 });

const Return = mongoose.model('Return', returnSchema);
export default Return;
