import mongoose from 'mongoose';

const pinCodeSchema = mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isCOD: {
        type: Boolean,
        default: true
    },
    // Phone demos are booked separately from delivery: a pincode can be
    // deliverable without a demo team covering it, so this is its own flag.
    demoEnabled: {
        type: Boolean,
        default: false,
        index: true
    },
    deliveryTime: {
        type: Number,
        default: 3,
        min: 1
    },
    deliveryUnit: {
        type: String,
        enum: ['minutes', 'hours', 'days'],
        default: 'days'
    }
}, {
    timestamps: true
});

pinCodeSchema.index({ createdAt: -1 });
pinCodeSchema.index({ isActive: 1, code: 1 });

const PinCode = mongoose.model('PinCode', pinCodeSchema);
export default PinCode;
