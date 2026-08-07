import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { normalizeAdminRole, normalizeSidebarPermissions } from '../constants/adminPermissions.js';

const adminSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['superadmin', 'subadmin', 'admin'],
        default: 'superadmin',
    },
    permissions: [{
        type: String
    }],
    lastLogin: {
        type: Date
    },
    fcmToken: {
        type: String,
        default: null
    },
    // Per-admin read marker for the sidebar order badge. Kept per account so
    // one admin opening Orders does not clear the badge for everyone else.
    ordersLastSeenAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
});

adminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

adminSchema.methods.getResolvedRole = function () {
    return normalizeAdminRole(this.role);
};

adminSchema.methods.getResolvedPermissions = function () {
    return normalizeSidebarPermissions(this.role, this.permissions);
};

adminSchema.pre('validate', function () {
    this.role = normalizeAdminRole(this.role);
    this.permissions = normalizeSidebarPermissions(this.role, this.permissions);
});

adminSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const Admin = mongoose.model('Admin', adminSchema);

export default Admin;
