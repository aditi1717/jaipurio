import mongoose from 'mongoose';
import DemoBooking from '../models/DemoBooking.js';
import PinCode from '../models/PinCode.js';
import Product from '../models/Product.js';
import Notification from '../models/Notification.js';

const BOOKABLE_SLOTS = ['morning', 'afternoon', 'evening', 'any'];
const BOOKING_STATUSES = ['Requested', 'Confirmed', 'Scheduled', 'Completed', 'Cancelled'];

const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const normalizePincode = (value) => String(value ?? '').replace(/\D/g, '').slice(0, 6);
const normalizePhone = (value) => String(value ?? '').replace(/\D/g, '').slice(-10);

// A pincode is demo-serviceable only when it exists, is active, and is
// explicitly flagged for demos — delivery coverage alone is not enough.
const findDemoServiceablePincode = (code) =>
    PinCode.findOne({ code, isActive: true, demoEnabled: true }).lean();

// @desc    Check whether a pincode can be booked for a phone demo
// @route   GET /api/demo-bookings/check/:code
// @access  Public
export const checkDemoPincode = async (req, res) => {
    try {
        const code = normalizePincode(req.params.code);
        if (code.length !== 6) {
            return res.status(400).json({ isServiceable: false, message: 'Enter a valid 6-digit pincode' });
        }

        const pinCode = await findDemoServiceablePincode(code);
        if (!pinCode) {
            return res.json({
                isServiceable: false,
                message: 'Home demo is not available at this pincode yet.'
            });
        }

        return res.json({
            isServiceable: true,
            message: 'Home demo is available at this pincode.'
        });
    } catch (error) {
        console.error('Check demo pincode error:', error);
        return res.status(500).json({ message: 'Could not check this pincode right now' });
    }
};

// @desc    Book a phone demo at home
// @route   POST /api/demo-bookings
// @access  Public (a logged-in user is linked when present)
export const createDemoBooking = async (req, res) => {
    try {
        const customerName = clean(req.body.customerName, 120);
        const phone = normalizePhone(req.body.phone);
        const address = clean(req.body.address, 500);
        const pincode = normalizePincode(req.body.pincode);

        if (!customerName) return res.status(400).json({ message: 'Name is required' });
        if (phone.length !== 10) return res.status(400).json({ message: 'Enter a valid 10-digit phone number' });
        if (!address) return res.status(400).json({ message: 'Address is required' });
        if (pincode.length !== 6) return res.status(400).json({ message: 'Enter a valid 6-digit pincode' });

        // Re-check server-side: the client check is a convenience, not a gate.
        const serviceablePincode = await findDemoServiceablePincode(pincode);
        if (!serviceablePincode) {
            return res.status(400).json({
                message: 'Home demo is not available at this pincode yet.'
            });
        }

        const preferredSlot = BOOKABLE_SLOTS.includes(String(req.body.preferredSlot || '').toLowerCase())
            ? String(req.body.preferredSlot).toLowerCase()
            : 'any';

        const preferredDateValue = req.body.preferredDate ? new Date(req.body.preferredDate) : null;
        const preferredDate = preferredDateValue && !Number.isNaN(preferredDateValue.getTime())
            ? preferredDateValue
            : null;

        let product = null;
        let productName = clean(req.body.productName, 200);
        const requestedProduct = req.body.product;
        if (requestedProduct !== undefined && requestedProduct !== null && String(requestedProduct).trim()) {
            const query = mongoose.Types.ObjectId.isValid(String(requestedProduct))
                ? { _id: String(requestedProduct) }
                : { id: Number(requestedProduct) };
            const found = await Product.findOne(query).select('_id name').lean();
            if (found) {
                product = found._id;
                productName = productName || found.name || '';
            }
        }

        const bookingId = `DEMO-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

        const booking = await DemoBooking.create({
            bookingId,
            product,
            productName,
            user: req.user?._id || null,
            customerName,
            phone,
            email: clean(req.body.email, 160).toLowerCase(),
            address,
            landmark: clean(req.body.landmark, 200),
            city: clean(req.body.city, 120),
            state: clean(req.body.state, 120),
            pincode,
            preferredDate,
            preferredSlot,
            notes: clean(req.body.notes, 1000),
            status: 'Requested',
            timeline: [{ status: 'Requested', at: new Date(), note: 'Booking submitted by customer' }]
        });

        res.status(201).json({
            bookingId: booking.bookingId,
            status: booking.status,
            message: 'Demo booked. Our team will call you to confirm the slot.'
        });

        // Best-effort: never hold the customer's response open for the admin alert.
        Notification.create({
            type: 'general',
            title: 'New Phone Demo Booking',
            message: `${customerName} booked a home demo${productName ? ` for ${productName}` : ''} at ${pincode} (${phone}).`,
            relatedId: booking._id.toString()
        }).catch((error) => console.error('Demo booking notification failed:', error));
    } catch (error) {
        console.error('Create demo booking error:', error);
        res.status(500).json({ message: 'Could not submit your booking right now' });
    }
};

// @desc    List demo bookings
// @route   GET /api/demo-bookings
// @access  Private/Admin
export const getDemoBookings = async (req, res) => {
    try {
        const { status, search, pageNumber, limit } = req.query;
        const filter = {};

        if (status && status !== 'All' && BOOKING_STATUSES.includes(status)) {
            filter.status = status;
        }

        const term = clean(search, 80);
        if (term) {
            const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = { $regex: safe, $options: 'i' };
            filter.$or = [
                { bookingId: regex },
                { customerName: regex },
                { phone: regex },
                { pincode: regex },
                { productName: regex }
            ];
        }

        const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
        const page = Math.max(1, Number(pageNumber) || 1);

        const [bookings, total] = await Promise.all([
            DemoBooking.find(filter)
                .sort({ createdAt: -1 })
                .limit(pageSize)
                .skip(pageSize * (page - 1))
                .lean(),
            DemoBooking.countDocuments(filter)
        ]);

        res.json({
            bookings,
            page,
            pages: Math.max(1, Math.ceil(total / pageSize)),
            total
        });
    } catch (error) {
        console.error('Get demo bookings error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a demo booking
// @route   PUT /api/demo-bookings/:id
// @access  Private/Admin
export const updateDemoBooking = async (req, res) => {
    try {
        const booking = await DemoBooking.findById(req.params.id);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        const nextStatus = clean(req.body.status, 40);
        if (nextStatus && BOOKING_STATUSES.includes(nextStatus) && nextStatus !== booking.status) {
            booking.status = nextStatus;
            booking.timeline.push({
                status: nextStatus,
                at: new Date(),
                note: clean(req.body.note, 300)
            });
        }

        if (req.body.adminNotes !== undefined) booking.adminNotes = clean(req.body.adminNotes, 1000);
        if (req.body.assignedTo !== undefined) booking.assignedTo = clean(req.body.assignedTo, 120);

        if (req.body.preferredDate !== undefined) {
            const parsed = req.body.preferredDate ? new Date(req.body.preferredDate) : null;
            booking.preferredDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
        }

        const updated = await booking.save();
        res.json(updated);
    } catch (error) {
        console.error('Update demo booking error:', error);
        res.status(500).json({ message: error.message });
    }
};
