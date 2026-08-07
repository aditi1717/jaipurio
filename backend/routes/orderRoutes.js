import express from 'express';
const router = express.Router();
import { 
    addOrderItems, 
    exportOrdersCsv,
    getOrders,
    getMyOrders,
    getOrderById,
    updateOrderStatus,
    getOrderDelhiveryTracking,
    getOrderShippingTracking,
    assignOrderFulfillment,
    updateBulkOrderStatus,
    getNewOrderCount,
    markOrdersSeen
} from '../controllers/orderController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

router.route('/')
    .post(protect, addOrderItems) // Protected for creating
    .get(protect, admin, getOrders); // Admin for listing all orders

router.route('/export').get(protect, admin, exportOrdersCsv);

// Must stay above '/:id' so these are not read as an order id.
router.route('/new-count').get(protect, admin, getNewOrderCount);
router.route('/mark-seen').put(protect, admin, markOrdersSeen);

router.route('/myorders').get(protect, getMyOrders); // User's own orders

router.route('/bulk-status').put(protect, admin, updateBulkOrderStatus);

router.route('/:id')
    .get(protect, getOrderById); // Get specific order

router.route('/:id/delhivery-tracking').get(protect, getOrderDelhiveryTracking);
router.route('/:id/shipping-tracking').get(protect, getOrderShippingTracking);

router.route('/:id/fulfillment').put(protect, admin, assignOrderFulfillment);

router.route('/:id/status').put(protect, admin, updateOrderStatus);

export default router;
