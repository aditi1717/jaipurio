import Product from '../models/Product.js';
import Category from '../models/Category.js';
import SubCategory from '../models/SubCategory.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.js';
import PortalSession from '../models/PortalSession.js';
import ExcelJS from 'exceljs';
import { promises as fs } from 'node:fs';


const ACTIVE_CACHE_TTL_MS = 2 * 60 * 1000;
const PORTAL_INSIGHTS_CACHE_TTL_MS = 30 * 1000;
const PORTAL_ANALYTICS_SESSION_LIMIT = 5000;
const PORTAL_RECENT_SESSIONS_LIMIT = 100;
const INDIA_TIME_ZONE = 'Asia/Kolkata';
let activeVisibilityCache = {
    fetchedAt: 0,
    categories: [],
    subCategories: []
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getActiveVisibilityData = async () => {
    const now = Date.now();
    if (
        activeVisibilityCache.fetchedAt > 0 &&
        (now - activeVisibilityCache.fetchedAt) < ACTIVE_CACHE_TTL_MS
    ) {
        return activeVisibilityCache;
    }

    const [categories, subCategories] = await Promise.all([
        Category.find({ active: true }).select('_id id name').lean(),
        SubCategory.find({ isActive: true }).select('_id name category').lean()
    ]);

    activeVisibilityCache = {
        fetchedAt: now,
        categories,
        subCategories
    };

    return activeVisibilityCache;
};

const getListProjection = (lite = false) => {
    if (!lite) return null;
    // Exclude heavy PDP-only fields for category/listing pages.
    // Removed 'images' (array) to reduce payload size as listing pages only need the primary 'image' (thumbnail).
    return 'id name brand subcategoryBrand price originalPrice discount rating ratingCount viewCount viewStatsByState image category categoryId tags ram skus stock maxOrderQuantity createdAt subCategories subCategory';
};

const normalizeSubCategoryIds = (value) => {
    const source = Array.isArray(value) ? value : [value];
    return [...new Set(
        source
            .map((item) => {
                if (!item) return '';
                if (typeof item === 'string') return item;
                return String(item._id || item.id || item);
            })
            .map((id) => String(id || '').trim())
            .filter(Boolean)
    )];
};

const normalizeMaxOrderQuantity = (value) => {
    if (value === undefined || value === null || value === '') return 1;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 1;
    return Math.floor(parsed);
};

const normalizeViewState = (value = '') => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return 'Unknown';

    const normalized = trimmed
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

    const compact = normalized.toLowerCase().replace(/[^a-z]/g, '');
    if (['unknown', 'na', 'none', 'null', 'undefined', 'notavailable'].includes(compact)) {
        return 'Unknown';
    }

    return normalized;
};

const isUnknownViewState = (value = '') => normalizeViewState(value) === 'Unknown';

const getSortedStateBreakdown = (entries = []) => (
    (Array.isArray(entries) ? entries : [])
        .map((entry) => ({
            state: String(entry?.state || '').trim() || 'Unknown',
            count: Number(entry?.count || 0)
        }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => {
            const aUnknown = isUnknownViewState(a.state) ? 1 : 0;
            const bUnknown = isUnknownViewState(b.state) ? 1 : 0;
            if (aUnknown !== bUnknown) return aUnknown - bUnknown;
            return b.count - a.count || a.state.localeCompare(b.state);
        })
);

const pickTopViewState = (stateBreakdown = []) => (
    stateBreakdown.find((entry) => !isUnknownViewState(entry?.state)) || stateBreakdown[0] || null
);

const getKnownStateBreakdown = (entries = []) => (
    getSortedStateBreakdown(entries).filter((entry) => !isUnknownViewState(entry?.state))
);

const formatIndiaDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(date);

const parseDateKey = (dateKey = '') => {
    const normalized = String(dateKey || '').trim();
    if (!normalized) return null;
    const parsed = new Date(`${normalized}T00:00:00+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getWeekdayLabelFromDateKey = (dateKey = '') => {
    const parsed = parseDateKey(dateKey);
    if (!parsed) return null;
    const label = new Intl.DateTimeFormat('en-US', {
        timeZone: INDIA_TIME_ZONE,
        weekday: 'short'
    }).format(parsed);
    return String(label || '').replace(/[^a-zA-Z]/g, '');
};

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
    try {
        const { category, subcategory, all, pageNumber, limit, search, keyword, lite, ids, stockStatus } = req.query;
        let filter = {};
        const searchTerm = String(search || keyword || '').trim();
        const categoryTerm = decodeURIComponent(String(category || '').trim());
        const subCategoryTerm = decodeURIComponent(String(subcategory || '').trim());
        const isLite = lite === 'true' || lite === '1';
        const projection = getListProjection(isLite);
        const normalizedIds = String(ids || '')
            .split(',')
            .map((value) => String(value || '').trim())
            .filter(Boolean)
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));

        if (normalizedIds.length > 0) {
            filter.id = { $in: [...new Set(normalizedIds)].slice(0, 500) };
        }

        if (all !== 'true') {
            // Always filter by active categories and subcategories for public requests.
            const { categories: activeCategories, subCategories: activeSubCategories } = await getActiveVisibilityData();
            const activeCategoryIds = activeCategories.map(c => c.id);
            const activeSubCategoryIds = activeSubCategories.map(s => s._id);
            let matchedCategory = null;

            filter.categoryId = { $in: activeCategoryIds };

            if (categoryTerm) {
                const normalizedCategory = categoryTerm.toLowerCase();
                matchedCategory = activeCategories.find(
                    (cat) => String(cat?.name || '').trim().toLowerCase() === normalizedCategory
                );

                if (matchedCategory) {
                    // Support legacy products that may have category name but missing/incorrect categoryId.
                    const categoryRegex = new RegExp(`^${escapeRegex(categoryTerm)}$`, 'i');
                    filter.$and = [
                        ...(filter.$and || []),
                        {
                            $or: [
                                { categoryId: matchedCategory.id },
                                { category: categoryRegex }
                            ]
                        }
                    ];
                    delete filter.categoryId;
                } else {
                    filter.category = new RegExp(`^${escapeRegex(categoryTerm)}$`, 'i');
                }
            }

            if (subCategoryTerm) {
                const normalizedSubcategory = subCategoryTerm.toLowerCase();
                const subRegex = new RegExp(`^${escapeRegex(subCategoryTerm)}$`, 'i');
                // Must sit on its own between non-alphanumerics. An unanchored
                // substring made short subcategory names match unrelated
                // products — "mi" hit "Remix" and "Mini", pulling OPPO handsets
                // into the Mi listing. Written without \b or lookbehind so it
                // behaves identically in MongoDB's regex engine and for terms
                // ending in punctuation such as "C+".
                const nameRegex = new RegExp(
                    `(^|[^A-Za-z0-9])${escapeRegex(subCategoryTerm)}([^A-Za-z0-9]|$)`,
                    'i'
                );
                const scopedSubCategories = matchedCategory
                    ? activeSubCategories.filter((sub) => String(sub.category) === String(matchedCategory._id))
                    : activeSubCategories;

                let subCat = scopedSubCategories.find(
                    (sub) => String(sub?.name || '').trim().toLowerCase() === normalizedSubcategory
                );

                if (!subCat && !matchedCategory) {
                    subCat = activeSubCategories.find(
                        (sub) => String(sub?.name || '').trim().toLowerCase() === normalizedSubcategory
                    );
                }

                if (subCat) {
                    // Keep strict subCategory match when available, but also allow
                    // legacy product mappings where VIVO-like values are in brand/tags/name.
                    filter.$and = [
                        ...(filter.$and || []),
                        {
                            $or: [
                                { subCategories: subCat._id },
                                { subCategories: String(subCat._id) },
                                { subCategory: subCat._id },
                                { 'subCategory._id': subCat._id },
                                { tags: subRegex },
                                { brand: subRegex },
                                { subcategoryBrand: subRegex },
                                { name: nameRegex }
                            ]
                        }
                    ];
                } else {
                    // Fallback for data where brand names are encoded in tags/name instead of subCategories.
                    filter.$and = [
                        ...(filter.$and || []),
                        {
                            $or: [
                                { tags: subRegex },
                                { brand: subRegex },
                                { subcategoryBrand: subRegex },
                                { name: nameRegex }
                            ]
                        }
                    ];
                }
            } else {
                filter.$or = [
                    { subCategories: { $exists: false } },
                    { subCategories: { $size: 0 } },
                    { subCategories: { $in: activeSubCategoryIds } }
                ];
            }
        }

        if (all === 'true') {
            if (categoryTerm) {
                filter.category = new RegExp(`^${escapeRegex(categoryTerm)}$`, 'i');
            }
            if (subCategoryTerm) {
                const subRegex = new RegExp(`^${escapeRegex(subCategoryTerm)}$`, 'i');
                const orConditions = [
                    { tags: subRegex },
                    { brand: subRegex },
                    { subcategoryBrand: subRegex }
                ];
                if (/^[0-9a-fA-F]{24}$/.test(subCategoryTerm)) {
                    orConditions.push({ subCategories: subCategoryTerm });
                    orConditions.push({ subCategory: subCategoryTerm });
                }
                filter.$and = [
                    ...(filter.$and || []),
                    { $or: orConditions }
                ];
            }
        }

        if (stockStatus) {
            if (stockStatus === 'Low Stock') {
                filter.stock = { $gt: 0, $lte: 5 };
            } else if (stockStatus === 'Out of Stock') {
                filter.stock = 0;
            } else if (stockStatus === 'In Stock') {
                filter.stock = { $gt: 5 };
            }
        }

        if (searchTerm) {
            const searchPattern = searchTerm
                .split(/\s+/)
                .filter(Boolean)
                .map((part) => escapeRegex(part))
                .join('\\s*');
            const regex = new RegExp(searchPattern, 'i');
            const searchFilter = {
                $or: [
                    { name: regex },
                    { brand: regex },
                    { category: regex }
                ]
            };
            filter = Object.keys(filter).length > 0
                ? { $and: [filter, searchFilter] }
                : searchFilter;
        }

        // Pagination Logic
        if (pageNumber || limit) {
            const pageSize = Number(limit) || 12;
            const page = Number(pageNumber) || 1;

            const count = await Product.countDocuments(filter);
            let productQuery = Product.find(filter);
            if (projection) productQuery = productQuery.select(projection);
            productQuery = productQuery.populate('subCategories', 'name isActive');
            if (isLite) {
                productQuery = productQuery.lean();
            }

            const products = await productQuery
                .sort({ createdAt: -1 })
                .limit(pageSize)
                .skip(pageSize * (page - 1));

            return res.json({ 
                products, 
                page, 
                pages: Math.ceil(count / pageSize), 
                total: count 
            });
        } 

        // Default behavior (No pagination) - Backward Compatibility
        let productQuery = Product.find(filter);
        if (projection) productQuery = productQuery.select(projection);
        productQuery = productQuery.populate('subCategories', 'name isActive');
        if (isLite) {
            productQuery = productQuery.lean();
        }

        const products = await productQuery.sort({ createdAt: -1 });
            
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res) => {
    try {
        const { all } = req.query;
        const product = await Product.findOne({ id: req.params.id }).populate('subCategories', 'name isActive');
        
        if (product) {
            if (all !== 'true') {
                const Category = (await import('../models/Category.js')).default;
                const category = await Category.findOne({ id: product.categoryId });
                
                if (!category || !category.active) {
                    return res.status(404).json({ message: 'Product not found (category inactive)' });
                }

                if (product.subCategories && product.subCategories.length > 0) {
                    const hasActiveSub = product.subCategories.some(sub => sub.isActive);
                    if (!hasActiveSub) {
                        return res.status(404).json({ message: 'Product not found (subcategories inactive)' });
                    }
                }
            }

            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
    try {
        const normalizeSkus = (rawSkus) => {
            if (!Array.isArray(rawSkus)) return [];
            return rawSkus.map(sku => ({
                ...sku,
                stock: Math.max(0, Number(sku?.stock) || 0),
                price: Math.max(0, Number(sku?.price) || 0),
                originalPrice: Math.max(0, Number(sku?.originalPrice) || 0)
            }));
        };

        const deriveFromSkus = (skus) => {
            if (!Array.isArray(skus) || skus.length === 0) return null;
            const bestSku = skus.reduce((best, current) => {
                if (!best) return current;
                return Number(current.price) < Number(best.price) ? current : best;
            }, null);
            return {
                stock: skus.reduce((sum, sku) => sum + (Number(sku.stock) || 0), 0),
                price: bestSku ? Number(bestSku.price) || 0 : 0,
                originalPrice: bestSku ? Math.max(Number(bestSku.originalPrice) || 0, Number(bestSku.price) || 0) : 0
            };
        };

        let image = req.body.image;
        if (req.files && req.files.image && req.files.image[0]) {
            const uploadedMain = await uploadBufferToCloudinary(
                req.files.image[0],
                { folder: 'ecom_uploads/products' }
            );
            image = uploadedMain.secure_url;
        }

        let images = req.body.images || [];
        if (!Array.isArray(images)) {
            images = [images];
        }
        
        if (req.files && req.files.images) {
            const uploadedImagesResults = await Promise.all(
                req.files.images.map(file =>
                    uploadBufferToCloudinary(file, { folder: 'ecom_uploads/products' })
                )
            );
            const uploadedImages = uploadedImagesResults.map(r => r.secure_url);
            images = [...images, ...uploadedImages];
        }
        images = images.filter(img => img);

        const parseJSON = (data) => {
            if (Array.isArray(data)) {
                // Handle duplicate FormData entries (strings representing JSON)
                if (data.length > 0 && typeof data[0] === 'string' && (data[0].trim().startsWith('[') || data[0].trim().startsWith('{'))) {
                    return parseJSON(data[data.length - 1]);
                }
                return data;
            }
            if (typeof data === 'string') {
                try { return JSON.parse(data); } catch (e) { return data; }
            }
            return data;
        };

        const body = req.body;
        let variantHeadings = parseJSON(body.variantHeadings);
        const parsedSkus = normalizeSkus(parseJSON(body.skus));
        const derivedSkuValues = deriveFromSkus(parsedSkus);

        if (req.files && req.files.variant_images) {
            const variantFiles = req.files.variant_images;
            const uploadedVariantResults = await Promise.all(
                variantFiles.map(file =>
                    uploadBufferToCloudinary(file, { folder: 'ecom_uploads/products/variants' })
                )
            );
            const variantUrls = uploadedVariantResults.map(r => r.secure_url);
            if (Array.isArray(variantHeadings)) {
                variantHeadings = variantHeadings.map(vh => ({
                    ...vh,
                    options: vh.options.map(opt => {
                        const newOpt = { ...opt };
                        // Handle single primary background image
                        if (opt.image && typeof opt.image === 'string' && opt.image.startsWith('VARIANT_INDEX::')) {
                            const idx = parseInt(opt.image.split('::')[1]);
                            if (variantUrls[idx]) {
                                newOpt.image = variantUrls[idx];
                            }
                        }
                        // Handle multiple images array
                        if (Array.isArray(opt.images)) {
                            newOpt.images = opt.images.map(img => {
                                if (typeof img === 'string' && img.startsWith('VARIANT_INDEX::')) {
                                    const idx = parseInt(img.split('::')[1]);
                                    return variantUrls[idx] ? variantUrls[idx] : img;
                                }
                                return img;
                            });
                        }
                        return newOpt;
                    })
                }));
            }
        }

        let description = parseJSON(body.description);
        if (req.files && req.files.description_images) {
            const descFiles = req.files.description_images;
            const uploadedDescResults = await Promise.all(
                descFiles.map(file =>
                    uploadBufferToCloudinary(file, { folder: 'ecom_uploads/products/descriptions' })
                )
            );
            const descUrls = uploadedDescResults.map(r => r.secure_url);
            if (Array.isArray(description)) {
                description = description.map(desc => {
                    if (desc.image && typeof desc.image === 'string' && desc.image.startsWith('DESCRIPTION_INDEX::')) {
                        const idx = parseInt(desc.image.split('::')[1]);
                        if (descUrls[idx]) {
                             return { ...desc, image: descUrls[idx] };
                        }
                    }
                    return desc;
                });
            }
        }

        const resolvedCategoryId = body.categoryId ? Number(body.categoryId) : undefined;
        const selectedCategory = Number.isFinite(resolvedCategoryId)
            ? await Category.findOne({ id: resolvedCategoryId }).select('_id id name').lean()
            : null;

        if (!selectedCategory) {
            return res.status(400).json({ message: 'Valid category is required.' });
        }

        const subCategoryCountForCategory = await SubCategory.countDocuments({ category: selectedCategory._id });
        if (subCategoryCountForCategory === 0) {
            return res.status(400).json({ message: 'No subcategory exists for selected category. Please create subcategory first.' });
        }

        const normalizedSubCategories = normalizeSubCategoryIds(parseJSON(body.subCategories));
        if (normalizedSubCategories.length === 0) {
            return res.status(400).json({ message: 'Subcategory is mandatory.' });
        }

        const validSubCategories = await SubCategory.find({
            _id: { $in: normalizedSubCategories },
            category: selectedCategory._id
        }).select('_id').lean();

        if (validSubCategories.length !== normalizedSubCategories.length) {
            return res.status(400).json({ message: 'Selected subcategory does not belong to selected category.' });
        }

        const product = new Product({
            id: body.id || Date.now(),
            name: body.name,
            brand: body.brand,
            subcategoryBrand: String(body.subcategoryBrand || '').trim(),
            price: derivedSkuValues ? derivedSkuValues.price : Number(body.price),
            originalPrice: derivedSkuValues ? derivedSkuValues.originalPrice : Number(body.originalPrice),
            discount: body.discount,
            image,
            images,
            category: body.category || selectedCategory.name || 'Uncategorized',
            categoryId: resolvedCategoryId,
            subCategories: normalizedSubCategories,
            categoryPath: parseJSON(body.categoryPath),
            highlights: parseJSON(body.highlights),
            description,
            stock: derivedSkuValues ? derivedSkuValues.stock : Number(body.stock),
            maxOrderQuantity: normalizeMaxOrderQuantity(body.maxOrderQuantity),
            variantHeadings,
            skus: parsedSkus,
            deliveryDays: Number(body.deliveryDays),
            specifications: parseJSON(body.specifications) || [],
            warranty: parseJSON(body.warranty),
            returnPolicy: parseJSON(body.returnPolicy),
            b2bEnabled: body.b2bEnabled !== undefined ? String(body.b2bEnabled).toLowerCase() === 'true' : false
        });


        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
    try {
        const normalizeSkus = (rawSkus) => {
            if (!Array.isArray(rawSkus)) return [];
            return rawSkus.map(sku => ({
                ...sku,
                stock: Math.max(0, Number(sku?.stock) || 0),
                price: Math.max(0, Number(sku?.price) || 0),
                originalPrice: Math.max(0, Number(sku?.originalPrice) || 0)
            }));
        };

        const deriveFromSkus = (skus) => {
            if (!Array.isArray(skus) || skus.length === 0) return null;
            const bestSku = skus.reduce((best, current) => {
                if (!best) return current;
                return Number(current.price) < Number(best.price) ? current : best;
            }, null);
            return {
                stock: skus.reduce((sum, sku) => sum + (Number(sku.stock) || 0), 0),
                price: bestSku ? Number(bestSku.price) || 0 : 0,
                originalPrice: bestSku ? Math.max(Number(bestSku.originalPrice) || 0, Number(bestSku.price) || 0) : 0
            };
        };

        console.log('Update Product ID:', req.params.id);
        console.log('Update Body:', JSON.stringify(req.body, null, 2)); // improved logging

        const product = await Product.findOne({ id: req.params.id });

        if (product) {
            let image = req.body.image;
            if (req.files && req.files.image && req.files.image[0]) {
                const uploadedMain = await uploadBufferToCloudinary(
                    req.files.image[0],
                    { folder: 'ecom_uploads/products' }
                );
                image = uploadedMain.secure_url;
            }
            const hasImageFieldInBody = Object.prototype.hasOwnProperty.call(req.body, 'image');
            const hasUploadedMainImage = Boolean(req.files && req.files.image && req.files.image.length > 0);

            const hasImagesFieldInBody = Object.prototype.hasOwnProperty.call(req.body, 'images');
            const hasUploadedGalleryImages = Boolean(req.files && req.files.images && req.files.images.length > 0);

            let images = req.body.images || [];
            if (!Array.isArray(images)) {
                images = [images];
            }

            if (req.files && req.files.images) {
                const uploadedImagesResults = await Promise.all(
                    req.files.images.map(file =>
                        uploadBufferToCloudinary(file, { folder: 'ecom_uploads/products' })
                    )
                );
                const uploadedImages = uploadedImagesResults.map(r => r.secure_url);
                images = [...images, ...uploadedImages];
            }
            images = images.filter(Boolean);
             
            const parseJSON = (data) => {
                if (Array.isArray(data)) {
                    // Handle duplicate FormData entries (strings representing JSON)
                    if (data.length > 0 && typeof data[0] === 'string' && (data[0].trim().startsWith('[') || data[0].trim().startsWith('{'))) {
                        return parseJSON(data[data.length - 1]);
                    }
                    return data;
                }
                if (typeof data === 'string') {
                    try { return JSON.parse(data); } catch (e) { return data; }
                }
                return data;
            };

            // Prepare update object
            const updateData = { ...req.body };
            
            // Parse complex fields
            if (updateData.categoryPath) updateData.categoryPath = parseJSON(updateData.categoryPath);
            if (updateData.highlights) {
                let highlights = parseJSON(updateData.highlights);
                // Filter to ensure only valid highlights with heading and points
                if (Array.isArray(highlights)) {
                    highlights = highlights.map(h => ({
                        ...h,
                        points: h.points ? h.points.filter(p => p && p.toString().trim().length > 0) : []
                    })).filter(h => (h.heading && h.heading.trim().length > 0) || h.points.length > 0);
                }
                updateData.highlights = highlights;
            }
            if (updateData.skus) {
                updateData.skus = normalizeSkus(parseJSON(updateData.skus));
                const derivedSkuValues = deriveFromSkus(updateData.skus);
                if (derivedSkuValues) {
                    updateData.stock = derivedSkuValues.stock;
                    updateData.price = derivedSkuValues.price;
                    updateData.originalPrice = derivedSkuValues.originalPrice;
                }
            }
            if (updateData.warranty) updateData.warranty = parseJSON(updateData.warranty);
            if (updateData.returnPolicy) updateData.returnPolicy = parseJSON(updateData.returnPolicy);
            
            if (updateData.variantHeadings) {
                let variantHeadings = parseJSON(updateData.variantHeadings);
                if (req.files && req.files.variant_images) {
                    const variantFiles = req.files.variant_images;
                    const uploadedVariantResults = await Promise.all(
                        variantFiles.map(file =>
                            uploadBufferToCloudinary(file, { folder: 'ecom_uploads/products/variants' })
                        )
                    );
                    const variantUrls = uploadedVariantResults.map(r => r.secure_url);
                    if (Array.isArray(variantHeadings)) {
                        variantHeadings = variantHeadings.map(vh => ({
                            ...vh,
                            options: vh.options.map(opt => {
                                const newOpt = { ...opt };
                                // Handle single primary background image
                                if (opt.image && typeof opt.image === 'string' && opt.image.startsWith('VARIANT_INDEX::')) {
                                    const idx = parseInt(opt.image.split('::')[1]);
                                    if (variantUrls[idx]) {
                                        newOpt.image = variantUrls[idx];
                                    }
                                }
                                // Handle multiple images array
                                if (Array.isArray(opt.images)) {
                                    newOpt.images = opt.images.map(img => {
                                        if (typeof img === 'string' && img.startsWith('VARIANT_INDEX::')) {
                                            const idx = parseInt(img.split('::')[1]);
                                            return variantUrls[idx] ? variantUrls[idx] : img;
                                        }
                                        return img;
                                    });
                                }
                                return newOpt;
                            })
                        }));
                    }
                }
                updateData.variantHeadings = variantHeadings;
            }

            if (updateData.description) {
                let description = parseJSON(updateData.description);
                if (req.files && req.files.description_images) {
                    const descFiles = req.files.description_images;
                    const uploadedDescResults = await Promise.all(
                        descFiles.map(file =>
                            uploadBufferToCloudinary(file, { folder: 'ecom_uploads/products/descriptions' })
                        )
                    );
                    const descUrls = uploadedDescResults.map(r => r.secure_url);
                    if (Array.isArray(description)) {
                        description = description.map(desc => {
                            if (desc.image && typeof desc.image === 'string' && desc.image.startsWith('DESCRIPTION_INDEX::')) {
                                const idx = parseInt(desc.image.split('::')[1]);
                                if (descUrls[idx]) {
                                    return { ...desc, image: descUrls[idx] };
                                }
                            }
                            return desc;
                        });
                    }
                }
                updateData.description = description;
            }

            // Safe Number Casting
            const safeNum = (val, prev) => {
                if (val === undefined || val === null || val === '') return undefined;
                const num = Number(val);
                return isNaN(num) ? prev : num;
            };

            if (updateData.price !== undefined) updateData.price = safeNum(updateData.price, product.price);
            if (updateData.originalPrice !== undefined) updateData.originalPrice = safeNum(updateData.originalPrice, product.originalPrice);
            if (updateData.stock !== undefined) updateData.stock = safeNum(updateData.stock, product.stock);
            if (updateData.deliveryDays !== undefined) updateData.deliveryDays = safeNum(updateData.deliveryDays, product.deliveryDays);
            if (updateData.maxOrderQuantity !== undefined) {
                updateData.maxOrderQuantity = normalizeMaxOrderQuantity(updateData.maxOrderQuantity);
            }
            if (updateData.b2bEnabled !== undefined) {
                updateData.b2bEnabled = String(updateData.b2bEnabled).toLowerCase() === 'true';
            }
            if (updateData.subcategoryBrand !== undefined) {
                updateData.subcategoryBrand = String(updateData.subcategoryBrand || '').trim();
            }

            // Fix: Cast categoryId to Number safely
            if (updateData.categoryId !== undefined) {
                const catId = Number(updateData.categoryId);
                updateData.categoryId = isNaN(catId) ? undefined : catId;
            }

            if (updateData.subCategories !== undefined) {
                 updateData.subCategories = parseJSON(updateData.subCategories) || [];
            }

            if (updateData.specifications !== undefined) {
                updateData.specifications = parseJSON(updateData.specifications) || [];
            }

            const resolvedCategoryId = updateData.categoryId !== undefined
                ? Number(updateData.categoryId)
                : Number(product.categoryId);

            if (!Number.isFinite(resolvedCategoryId)) {
                return res.status(400).json({ message: 'Valid category is required.' });
            }

            const selectedCategory = await Category.findOne({ id: resolvedCategoryId }).select('_id id name').lean();
            if (!selectedCategory) {
                return res.status(400).json({ message: 'Valid category is required.' });
            }

            const subCategoryCountForCategory = await SubCategory.countDocuments({ category: selectedCategory._id });
            if (subCategoryCountForCategory === 0) {
                return res.status(400).json({ message: 'No subcategory exists for selected category. Please create subcategory first.' });
            }

            const finalSubCategories = normalizeSubCategoryIds(
                updateData.subCategories !== undefined ? updateData.subCategories : product.subCategories
            );
            if (finalSubCategories.length === 0) {
                return res.status(400).json({ message: 'Subcategory is mandatory.' });
            }

            const validSubCategories = await SubCategory.find({
                _id: { $in: finalSubCategories },
                category: selectedCategory._id
            }).select('_id').lean();

            if (validSubCategories.length !== finalSubCategories.length) {
                return res.status(400).json({ message: 'Selected subcategory does not belong to selected category.' });
            }

            updateData.categoryId = resolvedCategoryId;
            updateData.subCategories = finalSubCategories;
            if (!updateData.category) {
                updateData.category = selectedCategory.name;
            }

            // Update thumbnail even when empty, if client explicitly sent the field.
            if (hasImageFieldInBody || hasUploadedMainImage) updateData.image = image || '';
            // Update gallery even when empty, if client explicitly sent the field.
            if (hasImagesFieldInBody || hasUploadedGalleryImages) updateData.images = images;

            // Update fields
            Object.assign(product, updateData);
            
            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error('Update Product Fatal Error:', error);
        res.status(500).json({ 
            message: error.message, 
            stack: error.stack 
        });
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id });

        if (product) {
            await product.deleteOne();
            res.json({ message: 'Product removed' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// @desc    Update product stock
// @route   PUT /api/products/:id/stock
// @access  Private/Admin
export const updateProductStock = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id });

        if (product) {
            const { stock, skus, maxOrderQuantity } = req.body;

            if (stock !== undefined) {
                product.stock = Math.max(0, Number(stock) || 0);
            }

            if (skus !== undefined && Array.isArray(skus)) {
                const normalizedSkus = skus.map((sku) => ({
                    ...sku,
                    stock: Math.max(0, Number(sku?.stock) || 0),
                    price: Math.max(0, Number(sku?.price) || 0),
                    originalPrice: Math.max(0, Number(sku?.originalPrice) || 0)
                }));

                product.skus = normalizedSkus;
                product.markModified('skus');

                // Keep parent stock in sync with variant stock sum.
                product.stock = normalizedSkus.reduce((sum, sku) => sum + (Number(sku.stock) || 0), 0);
            }

            if (maxOrderQuantity !== undefined) {
                product.maxOrderQuantity = normalizeMaxOrderQuantity(maxOrderQuantity);
            }

            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error('Update Stock Error:', error);
        res.status(400).json({ message: error.message });
    }
};

// @desc    Increment product view count
// @route   POST /api/products/:id/view
// @access  Public
export const incrementProductView = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const normalizedState = normalizeViewState(req.body?.state);
        const existingStateEntry = Array.isArray(product.viewStatsByState)
            ? product.viewStatsByState.find((entry) => normalizeViewState(entry?.state) === normalizedState)
            : null;

        product.viewCount = Number(product.viewCount || 0) + 1;

        if (existingStateEntry) {
            existingStateEntry.count = Number(existingStateEntry.count || 0) + 1;
            existingStateEntry.state = normalizedState;
        } else {
            product.viewStatsByState.push({ state: normalizedState, count: 1 });
        }

        // --- Daily Stats tracking ---
        const todayDate = formatIndiaDateKey();
        const existingDailyEntry = Array.isArray(product.dailyViewStats)
            ? product.dailyViewStats.find((entry) => entry.date === todayDate)
            : null;

        const sessionId = String(req.headers['x-user-session-id'] || '').trim();

        if (existingDailyEntry) {
            existingDailyEntry.views = (Number(existingDailyEntry.views) || 0) + 1;
            
            if (sessionId) {
                if (!existingDailyEntry.visitedSessions) {
                    existingDailyEntry.visitedSessions = [];
                }
                if (!existingDailyEntry.visitedSessions.includes(sessionId)) {
                    existingDailyEntry.visitedSessions.push(sessionId);
                    existingDailyEntry.visitors = (Number(existingDailyEntry.visitors) || 0) + 1;
                }
            } else {
                // No session ID available — count as a unique visitor since we cannot deduplicate
                existingDailyEntry.visitors = (Number(existingDailyEntry.visitors) || 0) + 1;
            }
        } else {
            if (!product.dailyViewStats) product.dailyViewStats = [];
            product.dailyViewStats.push({
                date: todayDate,
                views: 1,
                visitors: 1,
                visitedSessions: sessionId ? [sessionId] : []
            });
        }

        // Keep only last 365 days of daily stats to avoid too much document bloat
        if (product.dailyViewStats.length > 365) {
            product.dailyViewStats = product.dailyViewStats.slice(-365);
        }

        product.markModified('dailyViewStats');
        await product.save();

        const stateBreakdown = getSortedStateBreakdown(product.viewStatsByState);
        const topState = pickTopViewState(stateBreakdown);

        res.json({
            id: product.id,
            name: product.name,
            viewCount: product.viewCount,
            topState
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get product view insights by state
// @route   GET /api/products/:id/view-insights
// @access  Private/Admin
export const getProductViewInsights = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id })
            .select('id name image brand category viewCount viewStatsByState dailyViewStats')
            .lean();

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const stateBreakdown = getKnownStateBreakdown(product.viewStatsByState);
        const preferredTopState = pickTopViewState(stateBreakdown);
        const topState = preferredTopState
            ? {
                ...preferredTopState,
                share: product.viewCount > 0
                    ? Number(((preferredTopState.count / Number(product.viewCount || 0)) * 100).toFixed(1))
                    : 0
            }
            : null;

        const dailyStats = Array.isArray(product.dailyViewStats) ? product.dailyViewStats : [];

        return res.json({
            id: product.id,
            name: product.name,
            image: product.image,
            brand: product.brand,
            category: product.category,
            viewCount: Number(product.viewCount || 0),
            topState,
            stateBreakdown,
            dailyStats: dailyStats.slice(-365)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
// Keyed by date range: a single shared slot would serve one range's numbers
// for another once the dashboard filter started sending a window.
const portalInsightsCache = new Map();

// @desc    Get the lightweight product list used by the product views dashboard
// @route   GET /api/products/view-insights/products
// @access  Private/Admin
export const getProductViewProducts = async (req, res) => {
    try {
        const startDate = String(req.query.startDate || '').trim();
        const endDate = String(req.query.endDate || '').trim();
        const hasRange = Boolean(startDate || endDate);

        const products = await Product.find({})
            .select(`id name image brand category viewCount viewStatsByState${hasRange ? ' dailyViewStats' : ''}`)
            .sort({ viewCount: -1, id: 1 })
            .lean();

        if (!hasRange) {
            return res.json(products);
        }

        // dailyViewStats keys are yyyy-mm-dd (IST), so plain string compare is enough.
        const scoped = products
            .map(({ dailyViewStats, ...product }) => {
                const days = (Array.isArray(dailyViewStats) ? dailyViewStats : [])
                    .filter((entry) => {
                        const date = String(entry?.date || '');
                        if (!date) return false;
                        if (startDate && date < startDate) return false;
                        if (endDate && date > endDate) return false;
                        return true;
                    });

                return {
                    ...product,
                    totalViewCount: Number(product.viewCount || 0),
                    viewCount: days.reduce((sum, entry) => sum + (Number(entry?.views) || 0), 0),
                    rangeVisitors: days.reduce((sum, entry) => sum + (Number(entry?.visitors) || 0), 0)
                };
            })
            .sort((a, b) => b.viewCount - a.viewCount);

        return res.json(scoped);
    } catch (error) {
        console.error('Error fetching product view products:', error);
        return res.status(500).json({ message: error.message });
    }
};

// @desc    Get portal-wide product view insights
// @route   GET /api/products/view-insights/portal
// @access  Private/Admin
export const getPortalViewInsights = async (req, res) => {
    try {
        const requestedStart = String(req.query?.startDate || '').trim();
        const requestedEnd = String(req.query?.endDate || '').trim();
        const cacheKey = `${requestedStart}|${requestedEnd}`;

        const cached = portalInsightsCache.get(cacheKey);
        if (cached && (Date.now() - cached.fetchedAt) < PORTAL_INSIGHTS_CACHE_TTL_MS) {
            return res.json(cached.data);
        }

        const now = new Date();
        const liveThreshold = new Date(now.getTime() - (5 * 60 * 1000));
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const recentDailyMap = new Map();

        // The dashboard filter drives the whole aggregate window, not just the
        // product table. Falls back to the previous 30-day default.
        const parsedStart = requestedStart ? new Date(`${requestedStart}T00:00:00`) : null;
        const parsedEnd = requestedEnd ? new Date(`${requestedEnd}T23:59:59.999`) : null;

        const recentStart = parsedStart && !Number.isNaN(parsedStart.getTime())
            ? parsedStart
            : (() => {
                const fallback = new Date(now);
                fallback.setDate(fallback.getDate() - 29);
                return fallback;
            })();
        recentStart.setHours(0, 0, 0, 0);

        const rangeEnd = parsedEnd && !Number.isNaN(parsedEnd.getTime()) ? parsedEnd : now;
        const rangeDays = Math.max(
            1,
            Math.min(365, Math.round((rangeEnd - recentStart) / (24 * 60 * 60 * 1000)) + 1)
        );

        // Every aggregate below counts only page views inside the window, so the
        // funnel, engagement and distribution figures move with the filter too.
        const pagesInRange = (session) => (Array.isArray(session?.pagesVisited) ? session.pagesVisited : [])
            .filter((page) => {
                const at = page?.visitedAt ? new Date(page.visitedAt) : null;
                return at && !Number.isNaN(at.getTime()) && at >= recentStart && at <= rangeEnd;
            });

        const weekdayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const weeklyMap = new Map(weekdayOrder.map((day) => [day, { day, views: 0, visitors: 0 }]));

        const sessionsThreshold = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        const analyticsSessionFields = 'loginAt lastSeenAt pagesVisited.path pagesVisited.visitedAt referrer';
        const recentSessionFields = 'sessionId userId userRole authMethod loginAt lastSeenAt logoutAt isActive state pagesVisited.path pagesVisited.visitedAt';
        const [
            trackedProducts,
            totalVisitors,
            activeLoggedInUsers,
            liveActiveAllUsers,
            todayLogins,
            todayLogouts,
            totalLoginEvents,
            allPortalSessions,
            recentSessions
        ] = await Promise.all([
            Product.countDocuments(),
            // Scoped to the window: an all-time count would not move with the filter.
            PortalSession.countDocuments({ lastSeenAt: { $gte: recentStart, $lte: rangeEnd } }),
            PortalSession.countDocuments({ isActive: true, lastSeenAt: { $gte: liveThreshold }, userRole: { $ne: 'guest' } }),
            PortalSession.countDocuments({ isActive: true, lastSeenAt: { $gte: liveThreshold } }),
            PortalSession.countDocuments({ loginAt: { $gte: startOfToday }, userRole: { $ne: 'guest' } }),
            PortalSession.countDocuments({ logoutAt: { $gte: startOfToday }, userRole: { $ne: 'guest' } }),
            PortalSession.countDocuments({ userRole: { $ne: 'guest' } }),
            PortalSession.find({ lastSeenAt: { $gte: recentStart, $lte: rangeEnd } })
                .select(analyticsSessionFields)
                .sort({ lastSeenAt: -1 })
                .limit(PORTAL_ANALYTICS_SESSION_LIMIT)
                .lean(),
            PortalSession.find({ lastSeenAt: { $gte: sessionsThreshold } })
                .select(recentSessionFields)
                .sort({ lastSeenAt: -1 })
                .limit(PORTAL_RECENT_SESSIONS_LIMIT)
                .lean()
        ]);

        let totalViews = 0;

        for (const session of allPortalSessions) {
            const visitedDates = new Set();

            const loginAt = session?.loginAt ? new Date(session.loginAt) : null;
            if (loginAt && !Number.isNaN(loginAt.getTime()) && loginAt >= recentStart && loginAt <= rangeEnd) {
                visitedDates.add(formatIndiaDateKey(loginAt));
            }

            const lastSeenAt = session?.lastSeenAt ? new Date(session.lastSeenAt) : null;
            if (lastSeenAt && !Number.isNaN(lastSeenAt.getTime()) && lastSeenAt >= recentStart && lastSeenAt <= rangeEnd) {
                visitedDates.add(formatIndiaDateKey(lastSeenAt));
            }

            const pagesVisited = pagesInRange(session);
            totalViews += pagesVisited.length;

            for (const page of pagesVisited) {
                const visitedAt = page?.visitedAt ? new Date(page.visitedAt) : null;
                if (!visitedAt || Number.isNaN(visitedAt.getTime())) continue;

                const viewDateKey = formatIndiaDateKey(visitedAt);
                visitedDates.add(viewDateKey);

                if (visitedAt >= recentStart && visitedAt <= rangeEnd) {
                    const existing = recentDailyMap.get(viewDateKey) || { date: viewDateKey, views: 0, visitors: 0 };
                    existing.views += 1;
                    recentDailyMap.set(viewDateKey, existing);

                    const viewDayLabel = getWeekdayLabelFromDateKey(viewDateKey);
                    if (viewDayLabel && weeklyMap.has(viewDayLabel)) {
                        weeklyMap.get(viewDayLabel).views += 1;
                    }
                }
            }

            for (const dateKey of visitedDates) {
                const dateVal = parseDateKey(dateKey);
                if (!dateVal || dateVal < recentStart || dateVal > rangeEnd) continue;

                const existing = recentDailyMap.get(dateKey) || { date: dateKey, views: 0, visitors: 0 };
                existing.visitors += 1;
                recentDailyMap.set(dateKey, existing);

                const visitorDayLabel = getWeekdayLabelFromDateKey(dateKey);
                if (visitorDayLabel && weeklyMap.has(visitorDayLabel)) {
                    weeklyMap.get(visitorDayLabel).visitors += 1;
                }
            }
        }

        // Calculate page category distribution and engagement metrics
        const categoryCounts = {
            home: 0,
            pdp: 0,
            cart: 0,
            checkout: 0,
            categoryPage: 0,
            account: 0,
            other: 0
        };

        let bounces = 0;
        let totalDurationMs = 0;
        let timedSessionsCount = 0;
        let totalPagesVisited = 0;

        for (const session of allPortalSessions) {
            const pages = pagesInRange(session);
            const pagesCount = pages.length;
            totalPagesVisited += pagesCount;

            if (pagesCount === 1) {
                bounces += 1;
            } else if (pagesCount > 1) {
                const firstTime = new Date(pages[0].visitedAt).getTime();
                const lastTime = new Date(pages[pagesCount - 1].visitedAt).getTime();
                if (lastTime > firstTime) {
                    totalDurationMs += (lastTime - firstTime);
                    timedSessionsCount += 1;
                }
            }

            for (const page of pages) {
                const path = String(page?.path || '');
                if (path === '/') {
                    categoryCounts.home += 1;
                } else if (path.includes('/product/')) {
                    categoryCounts.pdp += 1;
                } else if (path.includes('/cart')) {
                    categoryCounts.cart += 1;
                } else if (path.includes('/checkout')) {
                    categoryCounts.checkout += 1;
                } else if (path.includes('/category/') || path === '/categories') {
                    categoryCounts.categoryPage += 1;
                } else if (['/account', '/my-orders', '/addresses', '/settings', '/wishlist'].some(p => path.includes(p))) {
                    categoryCounts.account += 1;
                } else {
                    categoryCounts.other += 1;
                }
            }
        }

        const pageDistribution = [
            { name: 'Home', value: categoryCounts.home },
            { name: 'Product Details', value: categoryCounts.pdp },
            { name: 'Cart', value: categoryCounts.cart },
            { name: 'Checkout', value: categoryCounts.checkout },
            { name: 'Categories', value: categoryCounts.categoryPage },
            { name: 'User Account', value: categoryCounts.account },
            { name: 'Others', value: categoryCounts.other }
        ].filter(item => item.value > 0);

        const totalSessionsCount = allPortalSessions.length;
        const bounceRate = totalSessionsCount > 0 ? Math.round((bounces / totalSessionsCount) * 100) : 0;
        const avgSessionDurationMin = timedSessionsCount > 0
            ? Number(((totalDurationMs / timedSessionsCount) / 1000 / 60).toFixed(1))
            : 0;
        const avgPageDepth = totalSessionsCount > 0
            ? Number((totalPagesVisited / totalSessionsCount).toFixed(1))
            : 1.0;

        // Calculate conversion funnel and referrer distribution
        let viewedPdpCount = 0;
        let visitedCartCount = 0;
        let initiatedCheckoutCount = 0;
        let purchasedCount = 0;

        const referrerMap = {};

        for (const session of allPortalSessions) {
            // Referrer tracking
            const ref = String(session.referrer || 'Direct').trim();
            let cleanRef = 'Direct';
            if (ref && ref !== 'Direct' && ref !== '') {
                try {
                    const urlObj = new URL(ref);
                    cleanRef = urlObj.hostname || ref;
                } catch (e) {
                    cleanRef = ref;
                }
            }
            if (cleanRef.includes('localhost') || cleanRef.includes('127.0.0.1')) {
                cleanRef = 'Direct';
            }
            referrerMap[cleanRef] = (referrerMap[cleanRef] || 0) + 1;

            // Funnel tracking
            const pages = pagesInRange(session);
            let hasPdp = false;
            let hasCart = false;
            let hasCheckout = false;
            let hasSuccess = false;

            for (const page of pages) {
                const path = String(page?.path || '');
                if (path.includes('/product/')) hasPdp = true;
                if (path.includes('/cart')) hasCart = true;
                if (path.includes('/checkout')) hasCheckout = true;
                if (path.includes('/order-success')) hasSuccess = true;
            }

            if (hasPdp) viewedPdpCount += 1;
            if (hasCart) visitedCartCount += 1;
            if (hasCheckout) initiatedCheckoutCount += 1;
            if (hasSuccess) purchasedCount += 1;
        }

        const referrerDistribution = Object.entries(referrerMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const conversionFunnel = {
            totalSessions: totalSessionsCount,
            viewedPdp: viewedPdpCount,
            visitedCart: visitedCartCount,
            initiatedCheckout: initiatedCheckoutCount,
            purchased: purchasedCount
        };

        // Walk the selected window rather than a fixed 30 days so the trend
        // chart spans exactly what the filter asked for.
        const dailyStats = [];
        for (let offset = 0; offset < rangeDays; offset += 1) {
            const date = new Date(recentStart);
            date.setDate(date.getDate() + offset);
            if (date > rangeEnd) break;
            const dateKey = formatIndiaDateKey(date);
            dailyStats.push(recentDailyMap.get(dateKey) || { date: dateKey, views: 0, visitors: 0 });
        }

        const weeklyDistribution = weekdayOrder.map((day) => weeklyMap.get(day));
        const sumDays = (entries) => entries.reduce((acc, entry) => ({
            views: acc.views + Number(entry?.views || 0),
            visitors: acc.visitors + Number(entry?.visitors || 0)
        }), { views: 0, visitors: 0 });

        const last7Days = sumDays(dailyStats.slice(-7));
        // Totals across the whole selected window, for when a filter is active.
        const rangeTotals = sumDays(dailyStats);
        const busiestDay = dailyStats.reduce((best, entry) => (
            Number(entry?.visitors || 0) > Number(best?.visitors || 0) ? entry : best
        ), dailyStats[0] || { date: '', views: 0, visitors: 0 });

        // Resolve user details using an optimized in-memory mapping
        const userIds = [...new Set(recentSessions.map(s => s.userId).filter(Boolean))];
        const User = (await import('../models/User.js')).default;
        const users = await User.find({ _id: { $in: userIds } }).select('name email phone').lean();
        const userMap = new Map(users.map(u => [String(u._id), u]));

        const populatedSessions = recentSessions.map(s => {
            const user = userMap.get(String(s.userId)) || null;
            return {
                ...s,
                user: user ? {
                    name: user.name,
                    email: user.email,
                    phone: user.phone || ''
                } : null
            };
        });

        const responseData = {
            trackedProducts,
            totalViews,
            totalVisitors,
            last7Days,
            rangeTotals,
            rangeStart: formatIndiaDateKey(recentStart),
            rangeEnd: formatIndiaDateKey(rangeEnd),
            busiestDay,
            dailyStats,
            weeklyDistribution,
            recentSessions: populatedSessions,
            pageDistribution,
            engagementStats: {
                bounceRate,
                avgSessionDurationMin,
                avgPageDepth
            },
            referrerDistribution,
            conversionFunnel,
            authStats: {
                activeLoggedInUsers,
                liveActiveAllUsers,
                todayLogins,
                todayLogouts,
                totalLoginEvents,
                liveWindowMinutes: 5
            }
        };

        portalInsightsCache.set(cacheKey, { fetchedAt: Date.now(), data: responseData });
        return res.json(responseData);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// @desc    Export current stock to Excel sheet
// @route   GET /api/products/stock/export
// @access  Private/Admin
export const exportStockExcel = async (req, res) => {
    try {
        // Optional scoping. No params means the whole catalogue, as before.
        const categoryTerm = String(req.query.category || '').trim();
        const subCategoryTerm = String(req.query.subcategory || '').trim();
        const filter = {};

        if (categoryTerm && categoryTerm !== 'All') {
            filter.category = new RegExp(`^${escapeRegex(categoryTerm)}$`, 'i');
        }

        if (subCategoryTerm && subCategoryTerm !== 'All') {
            const exact = new RegExp(`^${escapeRegex(subCategoryTerm)}$`, 'i');
            const conditions = [
                { brand: exact },
                { subcategoryBrand: exact },
                { tags: exact }
            ];

            // Match the stored reference too when the name resolves to a real
            // subcategory, so products tagged only by id are still included.
            const subCat = await SubCategory.findOne({ name: exact }).select('_id').lean();
            if (subCat) {
                conditions.push({ subCategories: subCat._id }, { subCategory: subCat._id });
            }

            filter.$or = conditions;
        }

        const products = await Product.find(filter).sort({ name: 1 });

        if (!products.length) {
            return res.status(404).json({ message: 'No products match the selected filter.' });
        }
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Stock Management');
        
        // Add title and instructions
        worksheet.mergeCells('A1:H1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'IndiaKart Bulk Stock Update Sheet';
        titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFF' } };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '1E3A8A' } // Navy Blue
        };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 40;
        
        worksheet.mergeCells('A2:H2');
        const instructionCell = worksheet.getCell('A2');
        instructionCell.value = 'INSTRUCTIONS: Only enter values in the "New Stock" column (Column H). Leave it blank if there is no change. Do NOT modify any other column.';
        instructionCell.font = { name: 'Arial', size: 10, italic: true, bold: true, color: { argb: 'B91C1C' } }; // Dark red
        instructionCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(2).height = 25;
        
        // Header Row (Row 4)
        const headers = [
            'Product ID',
            'Product Name',
            'Brand',
            'Has Variants',
            'Variant Combination',
            'Variant Index',
            'Current Stock',
            'New Stock'
        ];
        
        const headerRow = worksheet.getRow(4);
        headerRow.values = headers;
        headerRow.height = 28;
        
        // Style headers
        headers.forEach((h, colIndex) => {
            const cell = headerRow.getCell(colIndex + 1);
            cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '2563EB' } // Blue
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'D1D5DB' } },
                bottom: { style: 'medium', color: { argb: '1E40AF' } },
                left: { style: 'thin', color: { argb: 'D1D5DB' } },
                right: { style: 'thin', color: { argb: 'D1D5DB' } }
            };
        });
        
        // Data rows
        let rowIndex = 5;
        products.forEach(product => {
            if (product.skus && product.skus.length > 0) {
                // Has variants, add a row for each SKU
                product.skus.forEach((sku, skuIdx) => {
                    const row = worksheet.getRow(rowIndex);
                    
                    // Format combination object/Map to string
                    let comboStr = '';
                    if (sku.combination instanceof Map) {
                        comboStr = Array.from(sku.combination.entries())
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ');
                    } else if (sku.combination && typeof sku.combination === 'object') {
                        comboStr = Object.entries(sku.combination)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ');
                    }
                    
                    row.values = [
                        product.id,
                        product.name,
                        product.brand || 'N/A',
                        'Yes',
                        comboStr,
                        skuIdx,
                        sku.stock || 0,
                        '' // New Stock (blank)
                    ];
                    
                    styleDataRow(row, rowIndex);
                    rowIndex++;
                });
            } else {
                // No variants, add one row
                const row = worksheet.getRow(rowIndex);
                row.values = [
                    product.id,
                    product.name,
                    product.brand || 'N/A',
                    'No',
                    'N/A',
                    -1,
                    product.stock || 0,
                    '' // New Stock (blank)
                ];
                
                styleDataRow(row, rowIndex);
                rowIndex++;
            }
        });
        
        // Adjust column widths
        worksheet.columns.forEach((column, i) => {
            let maxLen = 0;
            column.eachCell({ includeEmpty: true }, (cell, rowNum) => {
                if (rowNum > 2) {
                    const val = cell.value ? String(cell.value) : '';
                    if (val.length > maxLen) maxLen = val.length;
                }
            });
            column.width = Math.max(maxLen + 4, 12);
        });
        
        function styleDataRow(row, rIdx) {
            const isEven = rIdx % 2 === 0;
            const bgHex = isEven ? 'F9FAFB' : 'FFFFFF'; // Zebra striping
            
            for (let c = 1; c <= 8; c++) {
                const cell = row.getCell(c);
                cell.font = { name: 'Arial', size: 10 };
                cell.alignment = { vertical: 'middle', horizontal: (c === 1 || c === 6 || c === 7 || c === 8) ? 'center' : 'left' };
                
                if (c < 8) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgHex }
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'E5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
                        left: { style: 'thin', color: { argb: 'E5E7EB' } },
                        right: { style: 'thin', color: { argb: 'E5E7EB' } }
                    };
                    if (c === 1 || c === 4 || c === 6) {
                        cell.font = { name: 'Arial', size: 9, color: { argb: '6B7280' } };
                    }
                } else {
                    // New Stock column
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'ECFDF5' } // Light green
                    };
                    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: '047857' } };
                    cell.border = {
                        top: { style: 'medium', color: { argb: '10B981' } },
                        bottom: { style: 'medium', color: { argb: '10B981' } },
                        left: { style: 'medium', color: { argb: '10B981' } },
                        right: { style: 'medium', color: { argb: '10B981' } }
                    };
                }
            }
        }
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="indiakart_stock_update.xlsx"');
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Export Stock Error:', error);
        res.status(500).json({ message: 'Failed to export stock sheet', error: error.message });
    }
};

// @desc    Import stock from uploaded Excel sheet
// @route   POST /api/products/stock/import
// @access  Private/Admin
export const importStockExcel = async (req, res) => {
    try {
        if (!req.file?.path) {
            return res.status(400).json({ message: 'Please upload an Excel spreadsheet file.' });
        }

        const workbook = new ExcelJS.Workbook();
        const fileBuffer = await fs.readFile(req.file.path);
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.worksheets[0];
        
        if (!worksheet) {
            return res.status(400).json({ message: 'Excel worksheet is empty or invalid.' });
        }

        let updatedProductsCount = 0;
        let totalRowsProcessed = 0;
        const errors = [];

        // Group updates by product ID
        const updates = {};

        const totalRows = worksheet.rowCount;
        for (let rowNumber = 5; rowNumber <= totalRows; rowNumber++) {
            const row = worksheet.getRow(rowNumber);
            const productIdVal = row.getCell(1).value;
            if (!productIdVal) continue; // Skip empty rows or title rows

            const productId = Number(productIdVal);
            if (isNaN(productId)) {
                errors.push(`Row ${rowNumber}: Invalid Product ID "${productIdVal}".`);
                continue;
            }

            const variantIndexVal = row.getCell(6).value;
            const newStockVal = row.getCell(8).value;

            totalRowsProcessed++;

            // Check if stock value was provided
            const newStockStr = (newStockVal !== null && newStockVal !== undefined) ? String(newStockVal).trim() : '';
            if (newStockStr === '') {
                continue; // No stock change requested
            }

            const newStockNum = Number(newStockStr);
            if (isNaN(newStockNum) || newStockNum < 0 || !Number.isInteger(newStockNum)) {
                errors.push(`Row ${rowNumber} (ID ${productId}): Invalid stock value "${newStockStr}". Must be a non-negative integer.`);
                continue;
            }

            const variantIndex = (variantIndexVal !== null && variantIndexVal !== undefined) ? Number(variantIndexVal) : -1;

            if (!updates[productId]) {
                updates[productId] = {
                    variantUpdates: {}
                };
            }

            if (variantIndex >= 0) {
                updates[productId].variantUpdates[variantIndex] = newStockNum;
            } else {
                updates[productId].parentStock = newStockNum;
            }
        }

        // Apply updates to the database
        for (const [productIdStr, productUpdate] of Object.entries(updates)) {
            const productId = Number(productIdStr);
            const product = await Product.findOne({ id: productId });
            if (!product) {
                errors.push(`Product ID ${productId}: Not found in database.`);
                continue;
            }

            let hasChanges = false;

            if (product.skus && product.skus.length > 0) {
                // Apply variant updates
                for (const [vIdxStr, newStock] of Object.entries(productUpdate.variantUpdates)) {
                    const idx = Number(vIdxStr);
                    if (idx >= 0 && idx < product.skus.length) {
                        product.skus[idx].stock = newStock;
                        hasChanges = true;
                    } else {
                        errors.push(`Product "${product.name}" (ID ${productId}): Invalid variant index ${idx}.`);
                    }
                }

                if (hasChanges) {
                    product.markModified('skus');
                    // Sync parent stock with sum of variant stock
                    product.stock = product.skus.reduce((sum, sku) => sum + (Number(sku.stock) || 0), 0);
                }
            } else {
                // Non-variant product
                if (productUpdate.parentStock !== undefined) {
                    product.stock = productUpdate.parentStock;
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await product.save();
                updatedProductsCount++;
            }
        }

        res.json({
            success: errors.length === 0 || updatedProductsCount > 0,
            message: errors.length === 0
                ? `Stock updated: ${updatedProductsCount} products updated successfully.`
                : `Stock updated: ${updatedProductsCount} products updated, but ${errors.length} validation errors occurred.`,
            summary: {
                totalRowsProcessed,
                updatedProductsCount,
                errorsCount: errors.length,
                errors
            }
        });

    } catch (error) {
        console.error('Import Stock Error:', error);
        res.status(500).json({ message: 'Failed to parse and import stock file.', error: error.message });
    } finally {
        if (req.file?.path) {
            await fs.unlink(req.file.path).catch(() => {});
        }
    }
};

