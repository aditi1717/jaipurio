import mongoose from 'mongoose';

const demoBookingSchema = mongoose.Schema({
    bookingId: { type: String, required: true, unique: true, index: true },

    // Optional: a demo can be booked from a product page or as a general request.
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productName: { type: String, default: '' },

    // Kept denormalised so a booking still reads correctly if the user is removed.
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, default: '', trim: true, lowercase: true },

    address: { type: String, required: true, trim: true },
    landmark: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pincode: { type: String, required: true, trim: true, index: true },

    preferredDate: { type: Date, default: null },
    preferredSlot: {
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'any'],
        default: 'any'
    },

    status: {
        type: String,
        enum: ['Requested', 'Confirmed', 'Scheduled', 'Completed', 'Cancelled'],
        default: 'Requested',
        index: true
    },
    notes: { type: String, default: '', trim: true },
    adminNotes: { type: String, default: '', trim: true },
    assignedTo: { type: String, default: '', trim: true },

    timeline: [{
        status: { type: String },
        at: { type: Date, default: Date.now },
        note: { type: String, default: '' }
    }]
}, {
    timestamps: true
});

demoBookingSchema.index({ createdAt: -1 });
demoBookingSchema.index({ status: 1, createdAt: -1 });

const DemoBooking = mongoose.model('DemoBooking', demoBookingSchema);

export default DemoBooking;
