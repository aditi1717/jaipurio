import Notification from '../models/Notification.js';
import User from '../models/User.js';
import FcmToken from '../models/FcmToken.js';
import firebaseAdmin from '../config/firebase.js';
import { mapWithConcurrency } from '../utils/asyncUtils.js';

const FCM_BATCH_SIZE = 500;
const TOKEN_CLEANUP_CONCURRENCY = 5;

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private/Admin
export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({}).sort({ createdAt: -1 }).limit(50);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private/Admin
export const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (notification) {
            notification.isRead = true;
            await notification.save();
            res.json(notification);
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private/Admin
export const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany({ isRead: false }, { isRead: true });
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Send push notification
// @route   POST /api/notifications/send
// @access  Private/Admin
export const sendPushNotification = async (req, res) => {
    const { title, message, type, targetAudience } = req.body;

    console.log('Push notification request:', { title, message, type, targetAudience });

    try {
        const invalidTokenCodes = new Set([
            'messaging/registration-token-not-registered',
            'messaging/invalid-registration-token'
        ]);

        const removeInvalidTokenEverywhere = async (token) => {
            if (!token) return;

            await FcmToken.deleteMany({ token });
            await User.updateMany(
                {
                    $or: [
                        { fcmToken: token },
                        { fcmTokenWeb: token },
                        { fcmTokenMobile: token }
                    ]
                },
                {
                    $unset: {
                        fcmToken: 1,
                        fcmTokenWeb: 1,
                        fcmTokenMobile: 1
                    }
                }
            );

            const Admin = (await import('../models/Admin.js')).default;
            await Admin.updateMany({ fcmToken: token }, { $unset: { fcmToken: 1 } });
        };

        const tokenProjection = 'fcmToken fcmTokenWeb fcmTokenMobile';
        const hasAnyTokenQuery = {
            $or: [
                { fcmTokenWeb: { $ne: null, $exists: true } },
                { fcmTokenMobile: { $ne: null, $exists: true } },
                { fcmToken: { $ne: null, $exists: true } }
            ]
        };
        const flattenUserTokens = (user) =>
            [user?.fcmTokenWeb, user?.fcmTokenMobile, user?.fcmToken].filter(Boolean);

        const normalizedAudience = (targetAudience || 'All Users').trim();
        const Admin = (await import('../models/Admin.js')).default;
        const seenTokens = new Set();
        let totalTargetTokens = 0;

        let firebaseSent = false;
        let successCount = 0;
        let failureCount = 0;
        const failureReasons = [];
        const sendTokenBatch = async (tokens) => {
            const uniqueBatch = tokens.filter((token) => {
                if (!token || seenTokens.has(token)) return false;
                seenTokens.add(token);
                return true;
            });

            if (uniqueBatch.length === 0) return;

            totalTargetTokens += uniqueBatch.length;

            if (!firebaseAdmin) {
                return;
            }

            const messages = uniqueBatch.map((token) => ({
                token,
                notification: {
                    title,
                    body: message,
                },
                data: {
                    type: type || 'general',
                    click_action: '/',
                },
                webpush: {
                    notification: {
                        icon: '/jaipurio-logo.png',
                        badge: '/jaipurio-logo.png'
                    }
                }
            }));

            const batchResponse = await firebaseAdmin.messaging().sendEach(messages);
            successCount += batchResponse.successCount;
            failureCount += batchResponse.failureCount;

            if (batchResponse.failureCount > 0) {
                const invalidTokens = [];
                batchResponse.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const code = resp.error?.code || 'unknown_error';
                        const errorMessage = resp.error?.message || 'Unknown Firebase error';
                        failureReasons.push({ token: uniqueBatch[idx], code, message: errorMessage });
                        if (invalidTokenCodes.has(code)) {
                            invalidTokens.push(uniqueBatch[idx]);
                        }
                    }
                });

                await mapWithConcurrency(
                    invalidTokens,
                    (token) => removeInvalidTokenEverywhere(token),
                    TOKEN_CLEANUP_CONCURRENCY
                );
            }

            firebaseSent = firebaseSent || batchResponse.successCount > 0;
        };

        const flushTokenBuffer = async (tokenBuffer) => {
            if (tokenBuffer.length === 0) return [];
            await sendTokenBatch(tokenBuffer);
            return [];
        };

        const streamUserTokens = async (userQuery) => {
            let tokenBuffer = [];
            const cursor = User.find(userQuery).select(`${tokenProjection} _id`).lean().cursor();

            for await (const user of cursor) {
                tokenBuffer.push(...flattenUserTokens(user));
                if (tokenBuffer.length >= FCM_BATCH_SIZE) {
                    tokenBuffer = await flushTokenBuffer(tokenBuffer);
                }
            }

            return flushTokenBuffer(tokenBuffer);
        };

        const streamCollectionTokens = async (query = {}) => {
            let tokenBuffer = [];
            const cursor = FcmToken.find(query).select('token').lean().cursor();

            for await (const doc of cursor) {
                if (doc?.token) {
                    tokenBuffer.push(doc.token);
                }
                if (tokenBuffer.length >= FCM_BATCH_SIZE) {
                    tokenBuffer = await flushTokenBuffer(tokenBuffer);
                }
            }

            return flushTokenBuffer(tokenBuffer);
        };

        const streamAdminTokens = async () => {
            let tokenBuffer = [];
            const cursor = Admin.find({ fcmToken: { $ne: null, $exists: true } }).select('fcmToken').lean().cursor();

            for await (const admin of cursor) {
                if (admin?.fcmToken) {
                    tokenBuffer.push(admin.fcmToken);
                }
                if (tokenBuffer.length >= FCM_BATCH_SIZE) {
                    tokenBuffer = await flushTokenBuffer(tokenBuffer);
                }
            }

            return flushTokenBuffer(tokenBuffer);
        };

        if (normalizedAudience === 'All Users') {
            await streamUserTokens(hasAnyTokenQuery);
            await streamCollectionTokens();
            await streamAdminTokens();
        } else if (normalizedAudience === 'New Users') {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const userIds = [];
            const cursor = User.find({ createdAt: { $gte: thirtyDaysAgo } }).select(`${tokenProjection} _id`).lean().cursor();
            let tokenBuffer = [];

            for await (const user of cursor) {
                userIds.push(String(user._id));
                tokenBuffer.push(...flattenUserTokens(user));
                if (tokenBuffer.length >= FCM_BATCH_SIZE) {
                    tokenBuffer = await flushTokenBuffer(tokenBuffer);
                }
            }
            await flushTokenBuffer(tokenBuffer);
            await streamCollectionTokens({ userId: { $in: userIds } });
        } else if (normalizedAudience === 'Active Users' || normalizedAudience === 'Inactive Users') {
            const status = normalizedAudience === 'Active Users' ? 'active' : 'disabled';
            const userIds = [];
            const cursor = User.find({ status }).select(`${tokenProjection} _id`).lean().cursor();
            let tokenBuffer = [];

            for await (const user of cursor) {
                userIds.push(String(user._id));
                tokenBuffer.push(...flattenUserTokens(user));
                if (tokenBuffer.length >= FCM_BATCH_SIZE) {
                    tokenBuffer = await flushTokenBuffer(tokenBuffer);
                }
            }
            await flushTokenBuffer(tokenBuffer);
            await streamCollectionTokens({ userId: { $in: userIds } });
        } else {
            const userIds = [];
            const cursor = User.find({}).select(`${tokenProjection} _id`).lean().cursor();
            let tokenBuffer = [];

            for await (const user of cursor) {
                userIds.push(String(user._id));
                tokenBuffer.push(...flattenUserTokens(user));
                if (tokenBuffer.length >= FCM_BATCH_SIZE) {
                    tokenBuffer = await flushTokenBuffer(tokenBuffer);
                }
            }
            await flushTokenBuffer(tokenBuffer);
            await streamCollectionTokens({ userId: { $in: userIds } });
        }

        if (!firebaseAdmin && totalTargetTokens > 0) {
            console.warn('Firebase Admin not initialized');
            failureReasons.push({
                code: 'firebase_not_initialized',
                message: 'Firebase Admin SDK is not initialized on backend'
            });
        }

        if (totalTargetTokens === 0) {
            console.warn('No FCM tokens available');
            failureReasons.push({
                code: 'no_tokens',
                message: 'No FCM tokens found for selected audience'
            });
        }

        // 3. Store in history
        const typeToSchema = {
            order: 'order',
            order_update: 'order',
            return: 'return',
            returns: 'return',
            stock: 'stock',
            promotional: 'general',
            new_arrival: 'general',
            general: 'general'
        };
        const normalizedTypeKey = String(type || 'general').toLowerCase().replace(/\s+/g, '_');

        const notification = await Notification.create({
            title,
            message,
            type: typeToSchema[normalizedTypeKey] || 'general',
            status: firebaseSent ? 'sent' : (totalTargetTokens > 0 ? 'failed' : 'pending'),
            targetAudience
        });

        console.log('Notification saved to DB:', notification._id);

        res.status(201).json({
            ...notification._doc,
            firebaseSent,
            tokensTargeted: totalTargetTokens,
            firebaseSuccessCount: successCount,
            firebaseFailureCount: failureCount,
            failureReasons
        });
    } catch (error) {
        console.error('Push notification error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private/Admin
export const deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (notification) {
            await notification.deleteOne();
            res.json({ message: 'Notification removed' });
        } else {
            res.status(404).json({ message: 'Notification not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete all notifications
// @route   DELETE /api/notifications
// @access  Private/Admin
export const deleteAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({});
        res.json({ message: 'All notifications removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
