import express from 'express';
const router = express.Router();
import { getReturns, updateReturnStatus, createReturnRequest, getUserReturnRequests, assignReturnFulfillment } from '../controllers/returnController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import upload from '../middleware/upload.js';

router.route('/')
    .post(
        protect,
        (req, res, next) => {
            upload.array('proof_files', 6)(req, res, (err) => {
                if (err) {
                    return res.status(400).json({ message: err.message || 'Proof upload failed' });
                }
                return next();
            });
        },
        createReturnRequest
    )
    .get(protect, admin, getReturns);

router.route('/my-returns').get(protect, getUserReturnRequests);

router.route("/:id/fulfillment")
    .put(protect, admin, assignReturnFulfillment);

router.route("/:id")
    .put(protect, admin, updateReturnStatus);

export default router;
