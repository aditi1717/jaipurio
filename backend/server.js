import express from 'express'; // Reload trigger 5
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';

dotenv.config();

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

import connectDB from './config/db.js';

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
// ... existing imports ...

// ... middleware ...

import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import reelRoutes from './routes/reelRoutes.js';
import bannerRoutes from './routes/bannerRoutes.js';
import homeSectionRoutes from './routes/homeSectionRoutes.js';
import contentPageRoutes from './routes/contentPageRoutes.js';
import subCategoryRoutes from './routes/subCategoryRoutes.js';
import brandRoutes from './routes/brandRoutes.js';
import homeLayoutRoutes from './routes/homeLayoutRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import pinCodeRoutes from './routes/pinCodeRoutes.js';
import bankOfferRoutes from './routes/bankOfferRoutes.js';
import settingRoutes from './routes/settingRoutes.js';
import offerRoutes from './routes/offerRoutes.js';
import agentRoutes from './routes/agentRoutes.js';

import notificationRoutes from './routes/notificationRoutes.js';
import fcmRoutes from './routes/fcmRoutes.js';
import sellerRequestRoutes from './routes/sellerRequestRoutes.js';
import footerRoutes from './routes/footerRoutes.js';
import headerRoutes from './routes/headerRoutes.js';
import { ensureUploadsDir, UPLOADS_URL_PREFIX } from './utils/localStorage.js';


const app = express();

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    const requestId = req.get('X-Request-Id') || randomUUID();
    req.requestId = requestId;
    res.set('X-Request-Id', requestId);

    res.on("finish", () => {
        const durationMs = Date.now() - start;
        const log = durationMs >= 1000 ? console.warn : console.log;
        log(`[${requestId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`);
    });

    next();
});

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim().replace(/^["']|["']$/g, ''))
    : [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://flipkart-6t6p.vercel.app',
        'https://indiankart.in',
        'https://www.indiankart.in'
    ];

const allowedOriginSet = new Set(
    allowedOrigins
        .map((origin) => {
            try {
                const parsed = new URL(origin);
                return `${parsed.protocol}//${parsed.host}`;
            } catch {
                return '';
            }
        })
        .filter(Boolean)
);

app.use(cors({
    origin: function (origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        let normalizedOrigin = '';
        try {
            const parsedOrigin = new URL(origin);
            normalizedOrigin = `${parsedOrigin.protocol}//${parsedOrigin.host}`;
        } catch (_error) {
            console.log('CORS blocked invalid origin:', origin);
            return callback(null, false);
        }

        const isAllowed = allowedOriginSet.has(normalizedOrigin);

        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Locally hosted media (replaces Cloudinary). In production nginx serves this
// path directly; this handler is the fallback for dev and any missed request.
app.use(
    UPLOADS_URL_PREFIX,
    express.static(ensureUploadsDir(), {
        maxAge: '30d',
        immutable: true,
        fallthrough: false,
        index: false,
        dotfiles: 'deny'
    })
);

// Connect to Database
await connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/home-sections', homeSectionRoutes);
app.use('/api/pages', contentPageRoutes);
app.use('/api/subcategories', subCategoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/home-layout', homeLayoutRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/pincodes', pinCodeRoutes);
app.use('/api/bank-offers', bankOfferRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/fcm', fcmRoutes);
app.use('/api/seller-requests', sellerRequestRoutes);
app.use('/api/footer', footerRoutes);
app.use('/api/header', headerRoutes);

app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
}

export default app;
