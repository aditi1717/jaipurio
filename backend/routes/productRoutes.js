import express from 'express';
const router = express.Router();
import { 
    getProducts, 
    getProductById, 
    createProduct, 
    updateProduct, 
    deleteProduct,
    updateProductStock,
    incrementProductView,
    getProductViewInsights,
    getProductViewProducts,
    getPortalViewInsights,
    exportStockExcel,
    exportB2BExcel,
    exportProductTemplate,
    importProductsExcel,
    importB2BExcel,
    importStockExcel
} from '../controllers/productController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import upload from '../middleware/upload.js';

const uploadMiddleware = (req, res, next) => {
    upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 50 }, { name: 'variant_images', maxCount: 200 }, { name: 'description_images', maxCount: 50 }])(req, res, (err) => {
        if (err) {
            console.error('Upload Middleware Error:', err);
            return res.status(400).json({ message: 'Image upload failed', error: err.message });
        }
        next();
    });
};

router.route('/')
    .get(getProducts)
    .post(protect, admin, uploadMiddleware, createProduct);

router.route('/bulk/template')
    .get(protect, admin, exportProductTemplate);

router.route('/bulk/import')
    .post(protect, admin, upload.single('file'), importProductsExcel);

router.route('/b2b/export')
    .get(protect, admin, exportB2BExcel);

router.route('/b2b/import')
    .post(protect, admin, upload.single('file'), importB2BExcel);

router.route('/stock/export')
    .get(protect, admin, exportStockExcel);

router.route('/stock/import')
    .post(protect, admin, upload.single('file'), importStockExcel);

router.route('/view-insights/products')
    .get(protect, admin, getProductViewProducts);

router.route('/view-insights/portal')
    .get(protect, admin, getPortalViewInsights);

router.route('/:id')

    .get(getProductById)
    .put(protect, admin, uploadMiddleware, updateProduct)
    .delete(protect, admin, deleteProduct);

router.route('/:id/stock')
    .put(protect, admin, updateProductStock);

router.route('/:id/view-insights')
    .get(protect, admin, getProductViewInsights);

router.route('/:id/view')
    .post(incrementProductView);

export default router;
