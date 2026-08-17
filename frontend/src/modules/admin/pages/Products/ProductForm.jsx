import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdClose, MdAdd, MdDelete, MdImage, MdExpandMore, MdExpandLess, MdArrowBack, MdOutlinePhotoCamera } from 'react-icons/md';
import useProductStore from '../../store/productStore';
import useCategoryStore from '../../store/categoryStore';
import useSubCategoryStore from '../../store/subCategoryStore';
import useBrandStore from '../../store/brandStore';
import RichTextEditor from '../../components/RichTextEditor';
import toast from 'react-hot-toast';

const PRODUCTION_UPLOAD_LIMIT_BYTES = 1024 * 1024;

const ProductForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addProduct, updateProduct, products, fetchProduct, isLoading } = useProductStore();
    const { categories, fetchCategories } = useCategoryStore();
    const { subCategories, fetchSubCategories } = useSubCategoryStore();
    const { brands, fetchBrands } = useBrandStore();

    useEffect(() => {
        if (categories.length === 0) fetchCategories();
        if (subCategories.length === 0) fetchSubCategories();
        if (brands.length === 0) fetchBrands();
        if (id) {
            fetchProduct(id);
        }
    }, [id, fetchProduct, fetchCategories, categories.length, fetchSubCategories, subCategories.length, fetchBrands, brands.length]);

    // Fetch product if editing
    const product = id ? products.find(p => p.id === parseInt(id)) : null;
    const isEdit = !!id;

    // Collapsible Sections State
    const [sections, setSections] = useState({
        highlights: true,
        description: true,
        warranty: true,
        returnPolicy: true
    });

    const [variantPage, setVariantPage] = useState(1);
    const variantsPerPage = 20;
    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleSection = (key) => setSections(prev => ({ ...prev, [key]: !prev[key] }));

    // Form State
    const [formData, setFormData] = useState({
        thumbnail: null, // { type: 'url'|'file', content: string|File, preview: string }
        galleryImages: [], // Array of image objects
        brand: '',
        subcategoryBrand: '',
        name: '',
        categoryPath: [],
        price: '',
        originalPrice: '',
        deliveryDays: 5,
        maxOrderQuantity: 1,
        // Dynamic Variant System
        variantHeadings: [], // { name: 'Color', hasImage: true, options: [{ name: 'Red', image: '' }] }
        skus: [], // { combination: { Color: 'Red', Size: 'M' }, price: 999, originalPrice: 1299, stock: 10 }
        subCategories: [], // Selected subcategory ObjectIds
        // Product Highlights (Structured sections with heading and points)
        highlights: [{ heading: '', points: [''] }],
        // Description with headings and points
        description: [{
            heading: '',
            content: '',
            image: null, // { type: 'url'|'file', content: string|File, preview: string }
            points: ['']
        }],

        // Specifications (Optional grouped specs)
        specifications: [{ groupName: '', specs: [{ key: '', value: '' }] }],

        // Warranty & Returns
        warranty: { summary: '', covered: '', notCovered: '' },
        returnPolicy: { days: 7, description: '' }
    });

    // Detect if category is Electronics for conditional warranty display
    const selectedCategory = React.useMemo(() =>
        categories.find(c => String(c.id || c._id) === String(formData.categoryPath[0] || '')),
        [categories, formData.categoryPath]
    );
    const isElectronics = selectedCategory?.name?.toLowerCase() === 'electronics';
    const availableSubCategories = React.useMemo(() => {
        if (!formData.categoryPath[0]) return [];
        const primaryCat = categories.find(c => String(c.id) === String(formData.categoryPath[0]));
        if (!primaryCat?._id) return [];

        return subCategories.filter((sub) => {
            const subCategoryId = sub.category?._id || sub.category;
            return String(subCategoryId) === String(primaryCat._id);
        });
    }, [categories, subCategories, formData.categoryPath]);

    const availableBrands = React.useMemo(() => {
        const selectedSubCategoryIds = new Set((formData.subCategories || []).map((id) => String(id)));
        if (selectedSubCategoryIds.size === 0) return [];

        return (brands || [])
            .filter((brand) => {
                const brandSubId = String(brand?.subcategory?._id || brand?.subcategory || '');
                return selectedSubCategoryIds.has(brandSubId);
            })
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    }, [brands, formData.subCategories]);

    const brandOptions = React.useMemo(() => {
        const seen = new Set();
        const base = [];

        for (const brand of availableBrands) {
            const name = String(brand?.name || '').trim();
            if (!name) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            base.push(name);
        }
        return base;
    }, [availableBrands]);

    // Populate form if editing
    useEffect(() => {
        if (product) {
            // Logic to separate primary image from gallery
            // Backend model: image (string), images (array of strings)

            const initThumbnail = product.image ? { type: 'url', content: product.image, preview: product.image } : null;
            const initGallery = (product.images || []).map(url => ({ type: 'url', content: url, preview: url }));

            setFormData({
                ...formData,
                ...product,
                thumbnail: initThumbnail,
                galleryImages: initGallery,
                price: product.price || '',
                originalPrice: product.originalPrice || '',
                maxOrderQuantity: product.maxOrderQuantity || 1,
                variantHeadings: (product.variantHeadings || []).map(vh => ({
                    ...vh,
                    options: (vh.options || []).map(opt => ({
                        ...opt,
                        image: opt.image ? (typeof opt.image === 'string' ? { type: 'url', content: opt.image, preview: opt.image } : opt.image) : null,
                        images: (opt.images || []).map(img => typeof img === 'string' ? { type: 'url', content: img, preview: img } : img)
                    }))
                })),
                categoryPath: product.categoryPath || (
                    product.categoryId
                        ? (product.subCategory ? [product.categoryId, (product.subCategory._id || product.subCategory)] : [product.categoryId])
                        : []
                ),
                subCategories: product.subCategories?.map(s => s._id || s) || (product.subCategory ? [product.subCategory._id || product.subCategory] : []),
                skus: product.skus || [],
                highlights: Array.isArray(product.highlights) ? product.highlights : [{ heading: '', points: [''] }],
                description: product.description ? product.description.map(d => ({
                    ...d,
                    image: d.image ? { type: 'url', content: d.image, preview: d.image } : null
                })) : [{ heading: '', content: '', image: null, points: [''] }],
                specifications: product.specifications || [{ groupName: '', specs: [{ key: '', value: '' }] }],
                warranty: product.warranty || { summary: '', covered: '', notCovered: '' },
                returnPolicy: product.returnPolicy || { days: 7, description: '' }
            });
        }
    }, [product]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const collectPendingUploadFiles = () => {
        const files = [];

        if (formData.thumbnail?.type === 'file' && formData.thumbnail.content) {
            files.push(formData.thumbnail.content);
        }

        (formData.galleryImages || []).forEach((img) => {
            if (img?.type === 'file' && img.content) {
                files.push(img.content);
            }
        });

        (formData.description || []).forEach((section) => {
            if (section?.image?.type === 'file' && section.image.content) {
                files.push(section.image.content);
            }
        });

        (formData.variantHeadings || []).forEach((heading) => {
            (heading?.options || []).forEach((option) => {
                if (option?.image?.type === 'file' && option.image.content) {
                    files.push(option.image.content);
                }

                (option?.images || []).forEach((img) => {
                    if (img?.type === 'file' && img.content) {
                        files.push(img.content);
                    }
                });
            });
        });

        return files;
    };

    const getPendingUploadSummary = () => {
        const files = collectPendingUploadFiles();
        const totalBytes = files.reduce((sum, file) => sum + (file?.size || 0), 0);

        return {
            files,
            totalBytes,
            totalMb: totalBytes / (1024 * 1024)
        };
    };

    // --- Image Handlers ---

    const handleThumbnailUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        setFormData(prev => ({
            ...prev,
            thumbnail: { type: 'file', content: file, preview: previewUrl }
        }));
    };

    const removeThumbnail = () => {
        setFormData(prev => ({ ...prev, thumbnail: null }));
    };

    const handleGalleryUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newImages = files.map(file => ({
            type: 'file',
            content: file,
            preview: URL.createObjectURL(file)
        }));

        setFormData(prev => ({
            ...prev,
            galleryImages: [...prev.galleryImages, ...newImages]
        }));
    };

    const removeGalleryImage = (index) => {
        setFormData(prev => ({
            ...prev,
            galleryImages: prev.galleryImages.filter((_, i) => i !== index)
        }));
    };

    // Helper for variant images
    const handleVariantFileUpload = (e, callback) => {
        const file = e.target.files[0];
        if (!file) return;
        const previewUrl = URL.createObjectURL(file);
        callback({ type: 'file', content: file, preview: previewUrl });
    };

    const handleVariantMultiFileUpload = (e, currentImages, callback) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const newImages = files.map(file => ({
            type: 'file',
            content: file,
            preview: URL.createObjectURL(file)
        }));

        callback([...(currentImages || []), ...newImages]);
    };

    const updateArrayItem = (field, index, value) => {
        const arr = [...formData[field]];
        arr[index] = value;
        setFormData(prev => ({ ...prev, [field]: arr }));
    };

    const addArrayItem = (field, emptyVal = '') => {
        setFormData(prev => ({ ...prev, [field]: [...prev[field], emptyVal] }));
    };

    const removeArrayItem = (field, index) => {
        setFormData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
    };

    const updateKV = (field, index, key, val) => {
        const items = [...formData[field]];
        items[index] = { ...items[index], [key]: val };
        setFormData(prev => ({ ...prev, [field]: items }));
    };

    // Parse pasted text into highlights format
    // First line = heading, subsequent lines = bullet points
    const parseHighlightsFromText = (text) => {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        if (lines.length === 0) return;

        const heading = lines[0];
        const points = lines.slice(1);

        // Add as new highlight section
        setFormData(prev => ({
            ...prev,
            highlights: [...prev.highlights, { heading, points: points.length > 0 ? points : [''] }]
        }));
    };

    // State for paste modal
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteText, setPasteText] = useState('');

    const handlePasteHighlights = () => {
        if (pasteText.trim()) {
            parseHighlightsFromText(pasteText);
            setPasteText('');
            setShowPasteModal(false);
            toast.success('Highlights parsed successfully!');
        }
    };

    // Description Management Functions
    const addDescriptionSection = () => {
        setFormData(prev => ({
            ...prev,
            description: [...prev.description, { heading: '', points: [''] }]
        }));
    };

    const removeDescriptionSection = (idx) => {
        setFormData(prev => ({
            ...prev,
            description: prev.description.filter((_, i) => i !== idx)
        }));
    };

    const updateDescriptionHeading = (idx, value) => {
        const newDesc = [...formData.description];
        newDesc[idx].heading = value;
        setFormData(prev => ({ ...prev, description: newDesc }));
    };

    const addDescriptionPoint = (headingIdx) => {
        const newDesc = [...formData.description];
        newDesc[headingIdx].points.push('');
        setFormData(prev => ({ ...prev, description: newDesc }));
    };

    const updateDescriptionPoint = (headingIdx, pointIdx, value) => {
        const newDesc = [...formData.description];
        newDesc[headingIdx].points[pointIdx] = value;
        setFormData(prev => ({ ...prev, description: newDesc }));
    };

    const removeDescriptionPoint = (headingIdx, pointIdx) => {
        const newDesc = [...formData.description];
        newDesc[headingIdx].points = newDesc[headingIdx].points.filter((_, i) => i !== pointIdx);
        setFormData(prev => ({ ...prev, description: newDesc }));
    };

    const updateDescriptionContent = (idx, value) => {
        const newDesc = [...formData.description];
        newDesc[idx].content = value;
        setFormData(prev => ({ ...prev, description: newDesc }));
    };

    const handleDescriptionImageUpload = (e, idx) => {
        const file = e.target.files[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        const newDesc = [...formData.description];
        newDesc[idx].image = { type: 'file', content: file, preview: previewUrl };
        setFormData(prev => ({ ...prev, description: newDesc }));
    };

    const removeDescriptionImage = (idx) => {
        const newDesc = [...formData.description];
        newDesc[idx].image = null;
        setFormData(prev => ({ ...prev, description: newDesc }));
    };

    const toggleSubCategory = (subId) => {
        setFormData(prev => {
            const current = prev.subCategories || [];
            if (current.includes(subId)) {
                return { ...prev, subCategories: current.filter(id => id !== subId) };
            } else {
                return { ...prev, subCategories: [...current, subId] };
            }
        });
    };

    // --- Dynamic Variant Helpers ---
    const addVariantHeading = () => {
        setFormData(prev => ({
            ...prev,
            variantHeadings: [...prev.variantHeadings, { id: Date.now(), name: '', hasImage: false, options: [{ name: '' }] }]
        }));
    };

    const removeVariantHeading = (id) => {
        setFormData(prev => ({
            ...prev,
            variantHeadings: prev.variantHeadings.filter(vh => vh.id !== id)
        }));
    };

    const updateVariantHeading = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            variantHeadings: prev.variantHeadings.map(vh => vh.id === id ? { ...vh, [field]: value } : vh)
        }));
    };

    const addVariantOption = (headingId) => {
        setFormData(prev => ({
            ...prev,
            variantHeadings: prev.variantHeadings.map(vh =>
                vh.id === headingId ? { ...vh, options: [...vh.options, { name: '', image: null, images: [] }] } : vh
            )
        }));
    };

    const updateVariantOption = (headingId, optIdx, field, value) => {
        setFormData(prev => ({
            ...prev,
            variantHeadings: prev.variantHeadings.map(vh => {
                if (vh.id === headingId) {
                    const newOptions = [...vh.options];
                    newOptions[optIdx] = { ...newOptions[optIdx], [field]: value };
                    return { ...vh, options: newOptions };
                }
                return vh;
            })
        }));
    };

    const removeVariantOption = (headingId, optIdx) => {
        setFormData(prev => ({
            ...prev,
            variantHeadings: prev.variantHeadings.map(vh => {
                if (vh.id === headingId) {
                    return { ...vh, options: vh.options.filter((_, i) => i !== optIdx) };
                }
                return vh;
            })
        }));
    };

    const generateCombinations = () => {
        const headings = formData.variantHeadings;
        if (headings.length === 0) return;

        let results = [{}];
        headings.forEach(heading => {
            const nextResults = [];
            results.forEach(result => {
                heading.options.forEach(option => {
                    if (!option.name) return;
                    nextResults.push({
                        ...result,
                        [heading.name || 'Variant']: option.name
                    });
                });
            });
            results = nextResults;
        });

        const newSkus = results.map(comb => {
            const existing = formData.skus.find(s =>
                Object.keys(comb).every(key => s.combination && s.combination[key] === comb[key])
            );
            return {
                combination: comb,
                price: existing ? (existing.price ?? '') : '',
                originalPrice: existing ? (existing.originalPrice ?? '') : '',
                stock: existing ? (existing.stock ?? '') : ''
            };
        });

        setFormData(prev => ({ ...prev, skus: newSkus }));
        setVariantPage(1);
    };

    const updateSkuField = (index, field, value) => {
        const newSkus = [...formData.skus];
        newSkus[index][field] = value;
        setFormData(prev => ({ ...prev, skus: newSkus }));
    };

    const getNormalizedSkus = () => {
        return (formData.skus || []).map(sku => ({
            ...sku,
            stock: Math.max(0, Number(sku.stock) || 0),
            price: Number(sku.price),
            originalPrice: Number(sku.originalPrice)
        }));
    };

    // Specifications handlers
    const addSpecificationGroup = () => {
        setFormData(prev => ({
            ...prev,
            specifications: [...prev.specifications, { groupName: '', specs: [{ key: '', value: '' }] }]
        }));
    };

    const removeSpecificationGroup = (groupIdx) => {
        setFormData(prev => ({
            ...prev,
            specifications: prev.specifications.filter((_, idx) => idx !== groupIdx)
        }));
    };

    const updateSpecificationGroupName = (groupIdx, value) => {
        const newSpecs = [...formData.specifications];
        newSpecs[groupIdx].groupName = value;
        setFormData(prev => ({ ...prev, specifications: newSpecs }));
    };

    const addSpecToGroup = (groupIdx) => {
        const newSpecs = [...formData.specifications];
        newSpecs[groupIdx].specs.push({ key: '', value: '' });
        setFormData(prev => ({ ...prev, specifications: newSpecs }));
    };

    const removeSpecFromGroup = (groupIdx, specIdx) => {
        const newSpecs = [...formData.specifications];
        newSpecs[groupIdx].specs = newSpecs[groupIdx].specs.filter((_, idx) => idx !== specIdx);
        setFormData(prev => ({ ...prev, specifications: newSpecs }));
    };

    const updateSpec = (groupIdx, specIdx, field, value) => {
        const newSpecs = [...formData.specifications];
        newSpecs[groupIdx].specs[specIdx][field] = value;
        setFormData(prev => ({ ...prev, specifications: newSpecs }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const normalizedSkus = getNormalizedSkus();

        if (normalizedSkus.some(sku => sku.stock < 0)) {
            toast.error('Stock cannot be negative');
            setIsSubmitting(false);
            return;
        }

        if (!formData.categoryPath[0]) {
            toast.error('Please select a primary category');
            setIsSubmitting(false);
            return;
        }

        if (availableSubCategories.length === 0) {
            toast.error('No subcategory exists for this category. Please create subcategory first.');
            setIsSubmitting(false);
            return;
        }

        if (!formData.subCategories || formData.subCategories.length === 0) {
            toast.error('Subcategory is mandatory. Please select a subcategory.');
            setIsSubmitting(false);
            return;
        }

        const skuForDisplay = normalizedSkus.reduce((best, current) => {
            if (!best) return current;
            return current.price < best.price ? current : best;
        }, null);

        const finalPrice = skuForDisplay ? skuForDisplay.price : Number(formData.price || 0);
        const finalOriginalPrice = skuForDisplay
            ? Math.max(skuForDisplay.originalPrice, skuForDisplay.price)
            : Number(formData.originalPrice || 0);

        const data = new FormData();
        data.append('name', formData.name?.trim() || 'Untitled Product');
        data.append('brand', formData.brand);
        data.append('subcategoryBrand', formData.subcategoryBrand || '');
        data.append('price', String(finalPrice));
        data.append('originalPrice', String(finalOriginalPrice));


        // Calculated fields
        const stock = normalizedSkus.length > 0
            ? normalizedSkus.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0)
            : Number(formData.stock);
        data.append('stock', String(stock));

        // Category Logic
        // 1. Primary Category (Legacy ID - Number)
        const primaryCategoryId = formData.categoryPath[0] || '';
        data.append('categoryId', String(primaryCategoryId)); // Parent ID

        // Find Category Name for display/legacy
        const selectedCategory = categories.find(c => String(c.id) === String(primaryCategoryId));
        data.append('category', selectedCategory ? selectedCategory.name : 'Uncategorized');

        // 2. SubCategories (New ObjectIds - Array)
        data.append('subCategories', JSON.stringify(formData.subCategories));

        // Backward compatibility for old controllers/fields
        if (formData.subCategories.length > 0) {
            data.append('subCategory', String(formData.subCategories[0]));
        } else {
            data.append('subCategory', '');
        }

        const discount = finalOriginalPrice > finalPrice
            ? `${Math.round(((finalOriginalPrice - finalPrice) / finalOriginalPrice) * 100)}% off`
            : '';
        if (discount) data.append('discount', discount);

        data.append('deliveryDays', String(Number(formData.deliveryDays) > 0 ? Number(formData.deliveryDays) : 5));
        data.append('maxOrderQuantity', String(Math.max(1, Number(formData.maxOrderQuantity) || 1)));

        // Complex objects
        data.append('categoryPath', JSON.stringify(formData.categoryPath));
        data.append('highlights', JSON.stringify(formData.highlights));
        data.append('highlights', JSON.stringify(formData.highlights));

        // Process Description Images
        const descriptionImages = [];
        const processedDescription = formData.description.map(desc => {
            const newDesc = { ...desc };
            if (newDesc.image && newDesc.image.type === 'file') {
                descriptionImages.push(newDesc.image.content);
                newDesc.image = `DESCRIPTION_INDEX::${descriptionImages.length - 1}`;
            } else if (newDesc.image && newDesc.image.type === 'url') {
                newDesc.image = newDesc.image.content;
            }
            // Handle cleanup of null/undefined images
            if (!newDesc.image) newDesc.image = '';
            return newDesc;
        });

        data.append('description', JSON.stringify(processedDescription));

        descriptionImages.forEach(file => {
            data.append('description_images', file);
        });
        data.append('skus', JSON.stringify(normalizedSkus));
        data.append('highlights', JSON.stringify(formData.highlights));
        data.append('specifications', JSON.stringify(formData.specifications));
        data.append('warranty', JSON.stringify(formData.warranty));
        data.append('returnPolicy', JSON.stringify({
            days: Number(formData.returnPolicy?.days) > 0 ? Number(formData.returnPolicy.days) : 7,
            description: formData.returnPolicy?.description || ''
        }));

        // Process Variant Headings (handle nested images)
        const variantImages = [];
        const processedHeadings = formData.variantHeadings.map(vh => ({
            ...vh,
            options: vh.options.map(opt => {
                const newOpt = { ...opt };

                // Handle single primary image
                if (opt.image && opt.image.type === 'file') {
                    variantImages.push(opt.image.content);
                    newOpt.image = `VARIANT_INDEX::${variantImages.length - 1}`;
                } else if (opt.image && opt.image.type === 'url') {
                    newOpt.image = opt.image.content;
                } else if (!opt.image) {
                    newOpt.image = '';
                }

                // Handle multiple images array
                newOpt.images = (opt.images || []).map(img => {
                    if (img && img.type === 'file') {
                        variantImages.push(img.content);
                        return `VARIANT_INDEX::${variantImages.length - 1}`;
                    } else if (img && img.type === 'url') {
                        return img.content;
                    }
                    return img;
                });

                return newOpt;
            })
        }));
        data.append('variantHeadings', JSON.stringify(processedHeadings));

        variantImages.forEach(file => {
            data.append('variant_images', file);
        });

        // --- Handle Main Images ---

        // 1. Thumbnail
        if (formData.thumbnail?.type === 'file') {
            data.append('image', formData.thumbnail.content);
        } else if (formData.thumbnail?.content) {
            // Existing thumbnail URL
            data.append('image', formData.thumbnail.content);
        } else {
            // Explicitly allow clearing primary image
            data.append('image', '');
        }

        // 2. Gallery Images
        formData.galleryImages.forEach(img => {
            if (img.type === 'file') {
                data.append('images', img.content);
            } else {
                data.append('images', img.content); // Existing URL
            }
        });
        // Send explicit empty marker so backend can clear gallery when all images are removed.
        if (formData.galleryImages.length === 0) {
            data.append('images', '');
        }

        // ... (inside ProductForm component)

        try {
            if (isEdit) {
                await updateProduct(parseInt(id), data);
                toast.success('Product updated successfully!');
            } else {
                await addProduct(data);
                toast.success('Product created successfully!');
            }
            navigate('/admin/products', { replace: true });
        } catch (error) {
            console.error("Failed to save product:", error);
            const { totalBytes, totalMb, files } = getPendingUploadSummary();
            const isLikelyUploadLimitIssue =
                error.message === 'Network Error' &&
                files.length > 0 &&
                totalBytes > PRODUCTION_UPLOAD_LIMIT_BYTES;

            const message = isLikelyUploadLimitIssue
                ? `Upload failed because the production server is currently rejecting files above about 1 MB total. Current upload: ${totalMb.toFixed(2)} MB. Reduce image sizes or increase nginx client_max_body_size on backend.jaipurio.in.`
                : error.response?.data?.message || "Failed to save product. Please try again.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const findInTree = (items, targetId) => {
        for (const item of items) {
            if (String(item.id || item._id) === String(targetId)) return item;
            if (item.children) {
                const found = findInTree(item.children, targetId);
                if (found) return found;
            }
        }
        return null;
    };

    const findNameInTree = (items, targetId) => {
        const item = findInTree(items, targetId);
        return item ? item.name : '...';
    };

    return (
        <>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-6 bg-white p-4 md:p-5 rounded-2xl border border-gray-200">
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={() => navigate('/admin/products')}
                            className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-all text-gray-500 hover:text-gray-800 border border-transparent hover:border-gray-200"
                        >
                            <MdArrowBack size={20} className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                        <div>
                            <h1 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight">
                                Product Editor
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                        <button
                            onClick={() => navigate('/admin/products')}
                            className="px-3 py-2 md:px-6 md:py-2.5 rounded-xl text-xs md:text-sm font-bold text-gray-500 hover:text-gray-800 border border-gray-200 hover:bg-gray-50 transition-all"
                        >
                            Discard Changes
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading || isSubmitting}
                            className={`px-4 py-2 md:px-6 md:py-2.5 rounded-xl text-xs md:text-sm font-bold text-white transition flex items-center gap-2 ${(isLoading || isSubmitting) ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
                                }`}
                        >
                            {(isLoading || isSubmitting) ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {isEdit ? 'Updating...' : 'Saving...'}
                                </>
                            ) : (
                                isEdit ? 'Update Product' : 'Save Product'
                            )}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-8">
                    {/* Left Side: Product Configuration */}
                    <div className="lg:col-span-8 space-y-3 md:space-y-8">

                        {/* Basic Info Card */}
                        <section className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 space-y-4 md:space-y-6">
                            <div className="flex items-center gap-2 md:gap-3 border-b border-gray-50 pb-2 md:pb-4">
                                <span className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold text-sm md:text-base">1</span>
                                <h2 className="text-base md:text-lg font-bold text-gray-800">Basic Information</h2>
                            </div>


                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8 mb-3 md:mb-6">
                                {/* Thumbnail Selection */}
                                <div className="space-y-2 md:space-y-3">
                                    <label className="flex items-center gap-1 md:gap-2 text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <MdImage className="text-primary-500" size={14} />
                                        Primary Thumbnail
                                    </label>

                                    <div className="relative group w-full h-48 md:h-64 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-primary-400 hover:bg-primary-50/30">
                                        {formData.thumbnail ? (
                                            <>
                                                <img
                                                    src={formData.thumbnail.preview}
                                                    alt="Thumbnail"
                                                    className="w-full h-full object-contain p-2"
                                                />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                    <label className="p-3 bg-white rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg">
                                                        <MdImage className="text-primary-600" size={24} />
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/*"
                                                            onChange={handleThumbnailUpload}
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={removeThumbnail}
                                                        className="p-3 bg-white rounded-full hover:scale-110 transition-transform shadow-lg"
                                                    >
                                                        <MdDelete className="text-red-600" size={24} />
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                                <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                                                    <MdAdd size={32} />
                                                </div>
                                                <span className="text-sm font-bold text-gray-600">Click to upload Thumbnail</span>
                                                <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Supports JPG, PNG, WEBP</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleThumbnailUpload}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* Gallery Selection */}
                                <div className="space-y-3">
                                    <label className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <span className="flex items-center gap-2">
                                            <MdOutlinePhotoCamera className="text-purple-500" size={16} />
                                            Gallery Images
                                        </span>
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{formData.galleryImages.length} Images</span>
                                    </label>

                                    <div className="grid grid-cols-3 gap-2 h-64 overflow-y-auto pr-1">
                                        {/* Upload Card */}
                                        <label className="min-h-[100px] border-2 border-dashed border-gray-200 bg-gray-50 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/10 transition-all">
                                            <MdAdd className="text-gray-400 group-hover:text-purple-500" size={24} />
                                            <span className="text-[10px] font-bold text-gray-400 mt-1">Add</span>
                                            <input
                                                type="file"
                                                multiple
                                                className="hidden"
                                                accept="image/*"
                                                onChange={handleGalleryUpload}
                                            />
                                        </label>

                                        {/* Gallery Items */}
                                        {formData.galleryImages.map((img, idx) => (
                                            <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-100 bg-white h-[100px] shadow-sm">
                                                <img
                                                    src={img.preview}
                                                    alt={`Gallery ${idx}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeGalleryImage(idx)}
                                                    className="absolute top-1 right-1 bg-red-500/70 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-all z-10"
                                                >
                                                    <MdClose size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                                <div className="space-y-1 md:space-y-1.5">
                                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Brand / Manufacturer</label>
                                    <input
                                        type="text"
                                        name="brand"
                                        value={formData.brand}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 md:px-4 md:py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white outline-none transition-all font-bold text-gray-900 caret-black placeholder:text-gray-500 text-sm md:text-base"
                                        placeholder="e.g. NIKE, ADIDAS"
                                    />
                                </div>
                                <div className="space-y-1 md:space-y-1.5">
                                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Product Title</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 md:px-4 md:py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white outline-none transition-all font-bold text-gray-900 caret-black placeholder:text-gray-500 text-sm md:text-base"
                                        placeholder="Full product name..."
                                    />
                                </div>
                                <div className="space-y-1 md:space-y-1.5">
                                    <label className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Max Selling Quantity</label>
                                    <input
                                        type="number"
                                        name="maxOrderQuantity"
                                        min="1"
                                        value={formData.maxOrderQuantity}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 md:px-4 md:py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white outline-none transition-all font-bold text-gray-900 caret-black placeholder:text-gray-500 text-sm md:text-base"
                                        placeholder="1"
                                    />
                                    <p className="text-[11px] text-gray-500 font-medium">
                                        Every product starts at `1`. Increase it here if users should be able to buy more.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2 md:space-y-4 p-3 md:p-5 bg-gray-50 rounded-2xl border border-gray-100">
                                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                    <span className="material-icons text-sm text-primary-500">category</span>
                                    Category Attachment
                                </label>
                                <div className="grid grid-cols-1 gap-4">
                                    <select
                                        value={formData.categoryPath[0] || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;

                                            // Auto-populate variants based on category
                                            const selectedCat = categories.find(c => String(c.id) === String(val));
                                            let newHeadings = [];

                                            if (selectedCat) {
                                                const catName = selectedCat.name.toLowerCase();

                                                // Fashion: Color + Size
                                                if (catName.includes('fashion') || catName.includes('clothing') || catName.includes('shirt') || catName.includes('shoe')) {
                                                    newHeadings = [
                                                        { id: Date.now(), name: 'Color', hasImage: true, options: [{ name: '', image: '' }] },
                                                        { id: Date.now() + 1, name: 'Size', hasImage: false, options: [{ name: '' }] }
                                                    ];
                                                }
                                                // Mobile/Electronics: Color + Storage
                                                else if (catName.includes('mobile') || catName.includes('phone') || catName.includes('electronics')) {
                                                    newHeadings = [
                                                        { id: Date.now(), name: 'Color', hasImage: true, options: [{ name: '', image: '' }] },
                                                        { id: Date.now() + 1, name: 'Storage', hasImage: false, options: [{ name: '' }] }
                                                    ];
                                                }
                                                // Food/Grocery: Weight or Quantity
                                                else if (catName.includes('food') || catName.includes('grocery') || catName.includes('vegetable') || catName.includes('fruit')) {
                                                    newHeadings = [
                                                        { id: Date.now(), name: 'Weight/Quantity', hasImage: false, options: [{ name: '' }] }
                                                    ];
                                                }
                                            }

                                            setFormData(prev => ({
                                                ...prev,
                                                categoryPath: val ? [val] : [],
                                                subCategories: [], // Reset subcategories
                                                subcategoryBrand: '',
                                                // Apply new template if match found, otherwise keep existing (or clear if we want strict mode, but keeping existing is safer for unknown cats)
                                                variantHeadings: newHeadings.length > 0 ? newHeadings : prev.variantHeadings
                                            }));
                                        }}
                                        className="w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 outline-none focus:ring-2 ring-primary-100 text-sm font-medium text-gray-900"
                                    >
                                        <option value="">Select Primary Category</option>
                                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>

                                    {formData.categoryPath[0] && (
                                        <div className="mt-4">
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                Sub Category <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.subCategories[0] || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        subCategories: val ? [val] : [],
                                                        subcategoryBrand: ''
                                                    }));
                                                }}
                                                className="w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 outline-none focus:ring-2 ring-primary-100 text-sm font-medium text-gray-900"
                                            >
                                                <option value="">Select Sub Category</option>
                                                {availableSubCategories.map(sub => (
                                                    <option key={sub._id} value={sub._id}>{sub.name}</option>
                                                ))}
                                            </select>
                                            {availableSubCategories.length === 0 && (
                                                <p className="mt-2 text-xs font-semibold text-red-600">
                                                    No subcategory found for selected category. Create one first.
                                                </p>
                                            )}

                                            {formData.subCategories[0] && (
                                                <div className="mt-4">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                                        Subcategory Brand
                                                    </label>
                                                    <select
                                                        name="subcategoryBrand"
                                                        value={formData.subcategoryBrand}
                                                        onChange={handleChange}
                                                        className="w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 outline-none focus:ring-2 ring-primary-100 text-sm font-medium text-gray-900"
                                                    >
                                                        <option value="">Select Subcategory Brand</option>
                                                        {brandOptions.map((name) => (
                                                            <option key={name.toLowerCase()} value={name}>{name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Product Highlights (Dynamic Sections) */}
                        <section className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 space-y-4 md:space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-50 pb-2 md:pb-4">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <span className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold"><span className="material-icons text-sm md:text-[18px]">star</span></span>
                                    <h2 className="text-base md:text-lg font-bold text-gray-800">Product Highlights</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowPasteModal(true)}
                                    className="px-2 py-1 md:px-3 md:py-1.5 bg-primary-50 text-primary-700 rounded-lg text-[9px] md:text-[10px] font-bold uppercase tracking-wider hover:bg-primary-100 transition-colors flex items-center gap-1"
                                >
                                    <span className="material-icons text-xs md:text-sm">content_paste</span>
                                    Paste & Parse
                                </button>
                            </div>
                            <div className="space-y-4">
                                <p className="text-[11px] text-gray-500 font-bold uppercase">Create multiple highlight sections (e.g., Specifications, Easy Payment Options)</p>

                                {formData.highlights.map((section, sectionIdx) => (
                                    <div key={sectionIdx} className="border border-gray-200 rounded-2xl p-3 md:p-6 bg-gray-50/50 space-y-2 md:space-y-4">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="text"
                                                value={section.heading}
                                                onChange={(e) => {
                                                    const newHighlights = [...formData.highlights];
                                                    newHighlights[sectionIdx].heading = e.target.value;
                                                    setFormData(prev => ({ ...prev, highlights: newHighlights }));
                                                }}
                                                placeholder="Section Heading (e.g., Specifications)"
                                                className="flex-1 px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-white border border-gray-300 focus:border-primary-500 outline-none transition-all font-bold text-gray-900 caret-black placeholder:text-gray-500 text-xs md:text-base"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({
                                                    ...prev,
                                                    highlights: prev.highlights.filter((_, i) => i !== sectionIdx)
                                                }))}
                                                className="px-3 py-2 md:px-4 md:py-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-bold text-xs md:text-sm"
                                            >
                                                Remove
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Bullet Points</label>
                                            {section.points.map((point, pointIdx) => (
                                                <div key={pointIdx} className="flex items-center gap-2">
                                                    <span className="text-gray-400">•</span>
                                                    <input
                                                        type="text"
                                                        value={point}
                                                        onChange={(e) => {
                                                            const newHighlights = [...formData.highlights];
                                                            newHighlights[sectionIdx].points[pointIdx] = e.target.value;
                                                            setFormData(prev => ({ ...prev, highlights: newHighlights }));
                                                        }}
                                                        placeholder="Bullet point..."
                                                        className="flex-1 px-4 py-2 rounded-lg bg-white border border-gray-200 focus:border-primary-500 outline-none transition-all text-sm text-gray-900 caret-black placeholder:text-gray-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newHighlights = [...formData.highlights];
                                                            newHighlights[sectionIdx].points.splice(pointIdx, 1);
                                                            if (newHighlights[sectionIdx].points.length === 0) {
                                                                newHighlights[sectionIdx].points = [''];
                                                            }
                                                            setFormData(prev => ({ ...prev, highlights: newHighlights }));
                                                        }}
                                                        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-all text-sm font-bold"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newHighlights = [...formData.highlights];
                                                    newHighlights[sectionIdx].points.push('');
                                                    setFormData(prev => ({ ...prev, highlights: newHighlights }));
                                                }}
                                                className="mt-2 px-4 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-all text-sm font-bold"
                                            >
                                                + Add Bullet Point
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({
                                        ...prev,
                                        highlights: [...prev.highlights, { heading: '', points: [''] }]
                                    }))}
                                    className="w-full px-4 py-3 bg-[#1f2937] text-white rounded-xl hover:bg-[#111827] transition font-bold"
                                >
                                    + Add Highlight Section
                                </button>
                            </div>
                        </section>


                        {/* Warranty & Returns Policy Card */}
                        <section className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 space-y-4 md:space-y-6">
                            <div className="flex items-center gap-2 md:gap-3 border-b border-gray-50 pb-2 md:pb-4">
                                <span className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-sm md:text-base">2</span>
                                <h2 className="text-base md:text-lg font-bold text-gray-800">Warranty & Returns Policy</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                                {/* Warranty Section */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-b pb-2">Warranty Details</h3>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1 block">Warranty Summary</label>
                                        <input
                                            type="text"
                                            value={formData.warranty.summary}
                                            onChange={(e) => setFormData(prev => ({ ...prev, warranty: { ...prev.warranty, summary: e.target.value } }))}
                                            className="w-full px-3 py-2 md:px-4 md:py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white outline-none transition-all text-xs md:text-sm font-bold text-gray-900 caret-black placeholder:text-gray-500"
                                            placeholder="e.g. 1 Year Brand Warranty"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1 block">Covered in Warranty</label>
                                        <input
                                            type="text"
                                            value={formData.warranty.covered}
                                            onChange={(e) => setFormData(prev => ({ ...prev, warranty: { ...prev.warranty, covered: e.target.value } }))}
                                            className="w-full px-3 py-2 md:px-4 md:py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white outline-none transition-all text-xs md:text-sm font-bold text-gray-900 caret-black placeholder:text-gray-500"
                                            placeholder="e.g. Manufacturing Defects"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1 block">Not Covered in Warranty</label>
                                        <input
                                            type="text"
                                            value={formData.warranty.notCovered}
                                            onChange={(e) => setFormData(prev => ({ ...prev, warranty: { ...prev.warranty, notCovered: e.target.value } }))}
                                            className="w-full px-3 py-2 md:px-4 md:py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white outline-none transition-all text-xs md:text-sm font-bold text-gray-900 caret-black placeholder:text-gray-500"
                                            placeholder="e.g. Physical Damage"
                                        />
                                    </div>
                                </div>

                                {/* Return Policy Section */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-b pb-2">Return Policy</h3>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1 block">Return Window (Days)</label>
                                        <input
                                            type="number"
                                            value={formData.returnPolicy.days}
                                            onChange={(e) => setFormData(prev => ({ ...prev, returnPolicy: { ...prev.returnPolicy, days: e.target.value } }))}
                                            className="w-full px-3 py-2 md:px-4 md:py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white outline-none transition-all text-xs md:text-sm font-bold text-gray-900 caret-black"
                                            placeholder="e.g. 7"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1 block">Return Description</label>
                                        <textarea
                                            value={formData.returnPolicy.description}
                                            onChange={(e) => setFormData(prev => ({ ...prev, returnPolicy: { ...prev.returnPolicy, description: e.target.value } }))}
                                            className="w-full px-3 py-2 md:px-4 md:py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-orange-500 focus:bg-white outline-none transition-all text-xs md:text-sm font-bold text-gray-900 h-24 md:h-32 resize-none caret-black placeholder:text-gray-500"
                                            placeholder="e.g. Returns accepted..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Dynamic Variants Card */}
                        <section className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 space-y-5 md:space-y-6">
                            <div className="flex items-center justify-between border-b border-gray-50 pb-2 md:pb-4">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <span className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm md:text-base">4</span>
                                    <h2 className="text-base md:text-lg font-bold text-gray-800">Dynamic Variants & Stock</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={addVariantHeading}
                                    className="px-3 py-1.5 md:px-4 md:py-2 bg-primary-600 text-white text-[10px] md:text-xs font-bold rounded-xl hover:bg-primary-700 transition flex items-center gap-1 md:gap-2"
                                >
                                    <MdAdd size={16} /> Add Variant
                                </button>
                            </div>

                            {/* Variant Headings List */}
                            <div className="space-y-4 md:space-y-8">
                                {formData.variantHeadings.map(vh => (
                                    <div key={vh.id} className="bg-gray-50/50 p-3 md:p-6 rounded-2xl border border-gray-100 relative group animate-in slide-in-from-top-2">
                                        <button
                                            type="button"
                                            onClick={() => removeVariantHeading(vh.id)}
                                            className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition"
                                        >
                                            <MdDelete size={20} />
                                        </button>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6 mb-3 md:mb-6">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Variant Heading (e.g. Color, Size, Storage)</label>
                                                <input
                                                    type="text"
                                                    value={vh.name}
                                                    onChange={(e) => updateVariantHeading(vh.id, 'name', e.target.value)}
                                                    className="w-full px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-white border border-gray-200 outline-none focus:border-primary-500 font-bold text-gray-900 caret-black placeholder:text-gray-500 text-sm md:text-base"
                                                    placeholder="Enter heading..."
                                                />
                                            </div>
                                            <div className="flex items-end pb-1">
                                                <label className="flex items-center gap-3 cursor-pointer group/toggle">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            className="sr-only peer"
                                                            checked={vh.hasImage}
                                                            onChange={(e) => updateVariantHeading(vh.id, 'hasImage', e.target.checked)}
                                                        />
                                                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover/toggle:text-gray-800 transition-colors">Has Image Options</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{vh.name || 'Variant'} Options</label>
                                                <button
                                                    type="button"
                                                    onClick={() => addVariantOption(vh.id)}
                                                    className="text-[10px] font-black text-primary-600 hover:underline px-2"
                                                >
                                                    + ADD OPTION
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
                                                {vh.options.map((opt, optIdx) => (
                                                    <div key={optIdx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group/opt transition-all hover:border-primary-200">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeVariantOption(vh.id, optIdx)}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 z-10"
                                                        >
                                                            <MdClose size={12} />
                                                        </button>
                                                        <div className="flex flex-col gap-2">
                                                            <input
                                                                type="text"
                                                                placeholder="Option (e.g. Red, XL)"
                                                                value={opt.name}
                                                                onChange={(e) => updateVariantOption(vh.id, optIdx, 'name', e.target.value)}
                                                                className="text-xs font-bold border-b border-gray-200 outline-none p-1 focus:border-primary-500 text-gray-900 caret-black placeholder:text-gray-500"
                                                            />
                                                            {vh.hasImage && (
                                                                <div className="space-y-2">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {/* Existing Variant Images */}
                                                                        {(opt.images || []).map((img, imgIdx) => (
                                                                            <div key={imgIdx} className="relative group/vimg w-10 h-10 rounded-lg overflow-hidden border border-gray-200">
                                                                                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const newImages = opt.images.filter((_, i) => i !== imgIdx);
                                                                                        updateVariantOption(vh.id, optIdx, 'images', newImages);
                                                                                    }}
                                                                                    className="absolute top-0.5 right-0.5 bg-red-500/70 hover:bg-red-600 text-white rounded-full p-0.5 shadow-sm transition-all z-10"
                                                                                >
                                                                                    <MdClose size={12} />
                                                                                </button>
                                                                            </div>
                                                                        ))}

                                                                        {/* Add More Images Button */}
                                                                        <label className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-200 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-all">
                                                                            <MdAdd className="text-gray-400" size={16} />
                                                                            <input
                                                                                type="file"
                                                                                multiple
                                                                                className="hidden"
                                                                                accept="image/*"
                                                                                onChange={(e) => handleVariantMultiFileUpload(e, opt.images, (data) => updateVariantOption(vh.id, optIdx, 'images', data))}
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                                                                        {(opt.images || []).length} images added
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {formData.variantHeadings.length === 0 && (
                                    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <span className="material-icons text-gray-300 text-3xl">style</span>
                                        </div>
                                        <h3 className="text-sm font-bold text-gray-400 italic">No variants added yet.</h3>
                                        <p className="text-[10px] text-gray-300 mt-1 uppercase font-bold tracking-widest">Add Color, Size, or Storage options</p>
                                    </div>
                                )}

                                {/* Combinations Matrix */}
                                {formData.variantHeadings.some(vh => vh.options.some(opt => opt.name)) && (
                                    <div className="mt-6 md:mt-8 p-4 md:p-6 bg-gray-50 rounded-2xl border border-gray-200">
                                        <div className="flex justify-between items-center mb-4 md:mb-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white">
                                                    <span className="material-icons text-2xl">grid_view</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-tight">Combinations Matrix</h4>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">Manage variant pricing and stock</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={generateCombinations}
                                                className="px-3 py-2 md:px-6 md:py-2.5 bg-white text-primary-600 border border-primary-200 rounded-xl text-[10px] md:text-xs font-black shadow-sm hover:shadow-md transition-all flex items-center gap-1 md:gap-2"
                                            >
                                                <span className="material-icons text-sm">refresh</span>
                                                GENERATE ALL
                                            </button>
                                        </div>

                                        {formData.skus.length > 0 ? (
                                            <div className="space-y-2 md:space-y-4">
                                                <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm overflow-x-auto">
                                                    <table className="w-full text-left border-collapse min-w-[300px]">
                                                        <thead>
                                                            <tr className="bg-slate-900 border-b border-slate-800">
                                                                {formData.variantHeadings.map(vh => (
                                                                    <th key={vh.id} className="px-3 py-2 md:px-6 md:py-4 text-[10px] md:text-xs font-black text-gray-900 uppercase tracking-widest whitespace-nowrap">{vh.name || 'Variant'}</th>
                                                                ))}
                                                                <th className="px-3 py-2 md:px-6 md:py-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-right whitespace-nowrap">Selling Price</th>
                                                                <th className="px-3 py-2 md:px-6 md:py-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-right whitespace-nowrap">Marked Price</th>
                                                                <th className="px-3 py-2 md:px-6 md:py-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-right whitespace-nowrap">Stock</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {formData.skus.slice((variantPage - 1) * variantsPerPage, variantPage * variantsPerPage).map((sku, idx) => {
                                                                const originalIdx = (variantPage - 1) * variantsPerPage + idx;
                                                                return (
                                                                    <tr key={originalIdx} className="hover:bg-primary-50/20 transition-colors">
                                                                        {formData.variantHeadings.map(vh => (
                                                                            <td key={vh.id} className="px-3 py-2 md:px-6 md:py-4 text-[10px] md:text-xs font-bold text-gray-700 whitespace-nowrap">
                                                                                {sku.combination[vh.name] || '-'}
                                                                            </td>
                                                                        ))}
                                                                        <td className="px-3 py-2 md:px-6 md:py-4 text-right">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                value={sku.price ?? ''}
                                                                                onChange={(e) => updateSkuField(originalIdx, 'price', Math.max(0, Number(e.target.value) || 0))}
                                                                                className="w-24 text-right px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 outline-none text-sm font-black text-gray-900 transition-all shadow-inner caret-black"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-2 md:px-6 md:py-4 text-right">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                value={sku.originalPrice ?? ''}
                                                                                onChange={(e) => updateSkuField(originalIdx, 'originalPrice', Math.max(0, Number(e.target.value) || 0))}
                                                                                className="w-24 text-right px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 outline-none text-sm font-black text-gray-900 transition-all shadow-inner caret-black"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-2 md:px-6 md:py-4 text-right">
                                                                            <div className="flex items-center justify-end gap-3 group/input">
                                                                                {Number(sku.stock) > 0 && Number(sku.stock) <= 5 && (
                                                                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest animate-pulse">Low Stock</span>
                                                                                )}
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    value={sku.stock ?? ''}
                                                                                    onChange={(e) => {
                                                                                        const raw = e.target.value;
                                                                                        if (raw === '') {
                                                                                            updateSkuField(originalIdx, 'stock', '');
                                                                                            return;
                                                                                        }
                                                                                        updateSkuField(originalIdx, 'stock', Math.max(0, parseInt(raw, 10) || 0));
                                                                                    }}
                                                                                    className="w-20 text-right px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 outline-none text-sm font-black text-gray-900 transition-all shadow-inner caret-black"
                                                                                />
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Variant Table Pagination */}
                                                {formData.skus.length > variantsPerPage && (
                                                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                                            Showing {(variantPage - 1) * variantsPerPage + 1} - {Math.min(variantPage * variantsPerPage, formData.skus.length)} of {formData.skus.length}
                                                        </span>
                                                        <div className="flex gap-2">
                                                            <button
                                                                type="button"
                                                                disabled={variantPage === 1}
                                                                onClick={() => setVariantPage(p => p - 1)}
                                                                className="p-1 px-3 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-30"
                                                            >
                                                                Prev
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={variantPage * variantsPerPage >= formData.skus.length}
                                                                onClick={() => setVariantPage(p => p + 1)}
                                                                className="p-1 px-3 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-30"
                                                            >
                                                                Next
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 opacity-40">
                                                <p className="text-xs font-bold italic">Click "Generate All" to see the inventory matrix</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Side: Media & Enhanced Metadata */}
                    <div className="lg:col-span-4 space-y-8">



                        {/* Metadata Card - Simplified */}
                        <section className="space-y-4">
                            {/* Description (Headings with Points) */}
                            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all">
                                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => toggleSection('description')}>
                                    <div className="flex items-center gap-3">
                                        <span className="material-icons text-indigo-500">description</span>
                                        <h3 className="font-bold text-gray-800 text-sm">Product Description</h3>
                                    </div>
                                    {sections.description ? <MdExpandLess /> : <MdExpandMore />}
                                </div>
                                {sections.description && (
                                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <p className="text-[11px] text-gray-500 font-bold uppercase mb-3">Add headings with bullet points for product details</p>
                                        <div className="space-y-6">
                                            {formData.description.map((section, sectionIdx) => (
                                                <div key={sectionIdx} className="bg-white p-4 rounded-xl border border-gray-200 relative group/section">
                                                    {/* Remove Section Button */}
                                                    {formData.description.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeDescriptionSection(sectionIdx)}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover/section:opacity-100 transition-all scale-75 group-hover/section:scale-100 z-10"
                                                        >
                                                            <MdClose size={12} />
                                                        </button>
                                                    )}

                                                    {/* Heading Input */}
                                                    <div className="mb-3">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Section Heading</label>
                                                        <input
                                                            type="text"
                                                            placeholder="e.g. Display, Camera, Battery"
                                                            value={section.heading}
                                                            onChange={(e) => updateDescriptionHeading(sectionIdx, e.target.value)}
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-black text-gray-900 focus:border-indigo-600 focus:bg-white outline-none transition-all caret-black placeholder:text-gray-500"
                                                        />
                                                    </div>

                                                    {/* Points */}
                                                    <div className="space-y-3">
                                                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Bullet Points</label>
                                                        {section.points.map((point, pointIdx) => (
                                                            <div key={pointIdx} className="flex gap-2 group/point">
                                                                <span className="text-indigo-500 py-2.5 text-[20px] leading-none">•</span>
                                                                <input
                                                                    value={point}
                                                                    onChange={(e) => updateDescriptionPoint(sectionIdx, pointIdx, e.target.value)}
                                                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-bold text-gray-900 focus:border-indigo-600 focus:bg-white outline-none transition-all caret-black placeholder:text-gray-500"
                                                                    placeholder="e.g. 16.97 cm (6.68 inch) Full HD+ Display"
                                                                />
                                                                {section.points.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeDescriptionPoint(sectionIdx, pointIdx)}
                                                                        className="text-red-400 opacity-0 group-hover/point:opacity-100 transition-all"
                                                                    >
                                                                        <MdDelete size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <button
                                                            type="button"
                                                            onClick={() => addDescriptionPoint(sectionIdx)}
                                                            className="text-[11px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 flex items-center gap-1 mt-1"
                                                        >
                                                            <MdAdd size={14} /> Add Point
                                                        </button>
                                                    </div>

                                                    {/* Description Content */}
                                                    <div className="mt-4">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Paragraph Content <span className="text-gray-300 font-medium normal-case tracking-normal">(Optional)</span></label>
                                                        <textarea
                                                            value={section.content || ''}
                                                            onChange={(e) => updateDescriptionContent(sectionIdx, e.target.value)}
                                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-900 focus:border-indigo-600 focus:bg-white outline-none transition-all min-h-[100px] caret-black placeholder:text-gray-500"
                                                            placeholder="Detailed description paragraph..."
                                                        />
                                                    </div>

                                                    {/* Description Image */}
                                                    <div className="mt-4">
                                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Section Image <span className="text-gray-300 font-medium normal-case tracking-normal">(Optional)</span></label>
                                                        <div className="relative group w-full h-40 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-indigo-400 hover:bg-indigo-50/30">
                                                            {section.image ? (
                                                                <>
                                                                    <img
                                                                        src={section.image.preview}
                                                                        alt="Description"
                                                                        className="w-full h-full object-contain p-2"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                                        <label className="p-2 bg-white rounded-full cursor-pointer hover:scale-110 transition-transform shadow-lg">
                                                                            <MdImage className="text-indigo-600" size={20} />
                                                                            <input
                                                                                type="file"
                                                                                className="hidden"
                                                                                accept="image/*"
                                                                                onChange={(e) => handleDescriptionImageUpload(e, sectionIdx)}
                                                                            />
                                                                        </label>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeDescriptionImage(sectionIdx)}
                                                                            className="p-2 bg-white rounded-full hover:scale-110 transition-transform shadow-lg"
                                                                        >
                                                                            <MdDelete className="text-red-600" size={20} />
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                                                    <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-1 md:mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                                                        <MdAdd size={16} className="w-4 h-4 md:w-5 md:h-5" />
                                                                    </div>
                                                                    <span className="text-[10px] md:text-xs font-bold text-gray-600">Upload Image</span>
                                                                    <input
                                                                        type="file"
                                                                        className="hidden"
                                                                        accept="image/*"
                                                                        onChange={(e) => handleDescriptionImageUpload(e, sectionIdx)}
                                                                    />
                                                                </label>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addDescriptionSection}
                                            className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                                        >
                                            <MdAdd size={16} /> Add New Section
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Warranty - Only for Electronics */}
                            {isElectronics && (
                                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all">
                                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => toggleSection('warranty')}>
                                        <div className="flex items-center gap-3">
                                            <span className="material-icons text-green-500">verified_user</span>
                                            <h3 className="font-bold text-gray-800 text-sm">Warranty Information</h3>
                                        </div>
                                        {sections.warranty ? <MdExpandLess /> : <MdExpandMore />}
                                    </div>
                                    {sections.warranty && (
                                        <div className="p-4 bg-gray-50/50 border-t border-gray-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Warranty Summary</label>
                                                <input
                                                    type="text"
                                                    value={formData.warranty.summary}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, warranty: { ...prev.warranty, summary: e.target.value } }))}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 focus:border-primary-500 outline-none caret-black placeholder:text-gray-500"
                                                    placeholder="e.g. 1 Year Manufacturer Warranty"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">What's Covered</label>
                                                <textarea
                                                    value={formData.warranty.covered}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, warranty: { ...prev.warranty, covered: e.target.value } }))}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs h-20 font-bold text-gray-900 focus:border-primary-500 outline-none caret-black placeholder:text-gray-500"
                                                    placeholder="Manufacturing defects, parts replacement..."
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">What's Not Covered</label>
                                                <textarea
                                                    value={formData.warranty.notCovered}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, warranty: { ...prev.warranty, notCovered: e.target.value } }))}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs h-20 font-bold text-gray-900 focus:border-primary-500 outline-none caret-black placeholder:text-gray-500"
                                                    placeholder="Physical damage, water damage..."
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Specifications - Optional */}
                            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all">
                                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => toggleSection('specifications')}>
                                    <div className="flex items-center gap-3">
                                        <span className="material-icons text-purple-500">fact_check</span>
                                        <h3 className="font-bold text-gray-800 text-sm">Specifications (Optional)</h3>
                                    </div>
                                    {sections.specifications ? <MdExpandLess /> : <MdExpandMore />}
                                </div>
                                {sections.specifications && (
                                    <div className="p-3 md:p-4 bg-gray-50/50 border-t border-gray-100 space-y-3 md:space-y-4 animate-in fade-in slide-in-from-top-2">
                                        {formData.specifications.map((group, groupIdx) => (
                                            <div key={groupIdx} className="bg-white rounded-2xl border border-gray-200 p-3 md:p-4 space-y-2 md:space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="text"
                                                        value={group.groupName}
                                                        onChange={(e) => updateSpecificationGroupName(groupIdx, e.target.value)}
                                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:border-purple-500 outline-none caret-black placeholder:text-gray-500"
                                                        placeholder="Group Name (e.g., Warranty, Battery Features)"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeSpecificationGroup(groupIdx)}
                                                        className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                                                        title="Remove Group"
                                                    >
                                                        <MdDelete size={20} />
                                                    </button>
                                                </div>

                                                {group.specs.map((spec, specIdx) => (
                                                    <div key={specIdx} className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={spec.key}
                                                            onChange={(e) => updateSpec(groupIdx, specIdx, 'key', e.target.value)}
                                                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 focus:border-purple-500 outline-none caret-black placeholder:text-gray-500"
                                                            placeholder="Key (e.g., Battery Capacity)"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={spec.value}
                                                            onChange={(e) => updateSpec(groupIdx, specIdx, 'value', e.target.value)}
                                                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold text-gray-900 focus:border-purple-500 outline-none caret-black placeholder:text-gray-500"
                                                            placeholder="Value (e.g., 6500 mAh)"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSpecFromGroup(groupIdx, specIdx)}
                                                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 transition-colors"
                                                        >
                                                            <MdDelete size={16} />
                                                        </button>
                                                    </div>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => addSpecToGroup(groupIdx)}
                                                    className="w-full py-2 border border-dashed border-purple-300 rounded-lg text-purple-600 text-xs font-bold hover:bg-purple-50 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <MdAdd size={16} /> Add Specification
                                                </button>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            onClick={addSpecificationGroup}
                                            className="w-full py-2.5 bg-purple-100 text-purple-600 rounded-xl font-bold hover:bg-purple-200 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <MdAdd size={20} /> Add Specification Group
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>

            {/* Paste Highlights Modal */}
            {showPasteModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-4 md:p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900">Paste Highlights</h3>
                            <button
                                type="button"
                                onClick={() => { setShowPasteModal(false); setPasteText(''); }}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <MdClose size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500">
                            Paste text with <strong>first line as heading</strong> and <strong>subsequent lines as bullet points</strong>.
                        </p>
                        <textarea
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            className="w-full h-40 border border-gray-200 rounded-xl p-3 text-sm resize-none focus:border-yellow-500 outline-none text-gray-900 caret-black placeholder:text-gray-500"
                            placeholder={`Easy Payment Options\nNo cost EMI starting from ₹6,667/month\nCash on Delivery\nNet banking & Credit/ Debit/ ATM card`}
                        />
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setShowPasteModal(false); setPasteText(''); }}
                                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handlePasteHighlights}
                                className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl text-sm font-bold hover:bg-yellow-600"
                            >
                                Parse & Add
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ProductForm;

