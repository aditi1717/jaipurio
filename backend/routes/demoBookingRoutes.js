import express from 'express';
import {
    checkDemoPincode,
    createDemoBooking,
    getDemoBookings,
    updateDemoBooking
} from '../controllers/demoBookingController.js';
import { protect, protectOptional, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/check/:code', checkDemoPincode);

router.route('/')
    // protectOptional so guests can book while logged-in users get linked.
    .post(protectOptional, createDemoBooking)
    .get(protect, admin, getDemoBookings);

router.route('/:id')
    .put(protect, admin, updateDemoBooking);

export default router;
