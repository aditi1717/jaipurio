import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MdAdd, MdArrowDropDown, MdArrowForward, MdClose, MdDelete, MdDragIndicator, MdSearch, MdToggleOff, MdToggleOn } from 'react-icons/md';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useCategoryStore from '../../store/categoryStore';
import useSubCategoryStore from '../../store/subCategoryStore';
import useBrandStore from '../../store/brandStore';
import { useProducts } from '../../../../hooks/useData';
import API from '../../../../services/api';
import {
    getOrderedCategorySubCategories,
    mergeCategoryPageCatalogWithCategories,
    readCategoryPageCatalog,
    readCategoryPageCatalogAsync,
    writeCategoryPageCatalog
} from '../../../../utils/subCategoryPageConfig';

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const DEFAULT_SUBCATEGORIES_SECTION_ID = 'default-brands-section';
const CUSTOM_LINK_VALUE = '__custom__';
const SELECT_LINK_VALUE = '__select__';
const SELECTED_CATEGORY_STORAGE_KEY = 'subcategory-page-builder-selected-subcategory-v1';

const normalizeText = (value) => String(value || '').trim();
const buildCategoryPageRoute = (categoryName, subCategoryName = '') => {
    const base = `/category/${encodeURIComponent(normalizeText(categoryName))}`;
    return subCategoryName ? `${base}/${encodeURIComponent(normalizeText(subCategoryName))}` : base;
};

const getCategoryChildren = (category) => {
    const directChildren = Array.isArray(category?.children) ? category.children : [];
    if (directChildren.length > 0) return directChildren;
    return Array.isArray(category?.subCategories) ? category.subCategories : [];
};

const buildPageRouteOptions = (categories = []) => {
    const seen = new Set();
    const options = [];

    (Array.isArray(categories) ? categories : []).forEach((category) => {
        const categoryName = normalizeText(category?.name);
        if (!categoryName) return;

        const categoryLink = buildCategoryPageRoute(categoryName);
        if (!seen.has(categoryLink)) {
            seen.add(categoryLink);
            options.push({ value: categoryLink, label: categoryName });
        }

        getCategoryChildren(category).forEach((subCategory) => {
            const subCategoryName = normalizeText(subCategory?.name);
            if (!subCategoryName) return;

            const subCategoryLink = buildCategoryPageRoute(categoryName, subCategoryName);
            if (seen.has(subCategoryLink)) return;

            seen.add(subCategoryLink);
            options.push({
                value: subCategoryLink,
                label: `${categoryName} / ${subCategoryName}`
            });
        });
    });

    return options;
};

const buildProductRouteOptions = (products = []) => {
    const seen = new Set();

    return (Array.isArray(products) ? products : [])
        .map((product) => {
            const productId = String(product?.id || product?._id || '').trim();
            const productName = normalizeText(product?.name);
            if (!productId || !productName) return null;

            const value = `/product/${encodeURIComponent(productId)}`;
            if (seen.has(value)) return null;
            seen.add(value);

            return {
                value,
                label: `Product: ${productName}`
            };
        })
        .filter(Boolean);
};

const resolveLinkSelectValue = (link, options = []) => {
    const normalizedLink = normalizeText(link);
    if (!normalizedLink) return SELECT_LINK_VALUE;
    return options.some((option) => option.value === normalizedLink) ? normalizedLink : CUSTOM_LINK_VALUE;
};

const getProductId = (product) => String(product?.id || product?._id || '').trim();

const getProductCategoryLabel = (product) => {
    const rawCategory = product?.category;
    if (!rawCategory) return 'Uncategorized';
    if (typeof rawCategory === 'string') return rawCategory;
    return rawCategory?.name || 'Uncategorized';
};

const getProductSubtitle = (product) => {
    if (product?.subtitle) return String(product.subtitle).trim();

    const multi = Array.isArray(product?.subCategories) ? product.subCategories : [];
    const multiLabel = multi
        .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
        .filter(Boolean)
        .join(', ');
    if (multiLabel) return multiLabel;

    const single = product?.subCategory;
    if (!single) return '';
    return typeof single === 'string' ? single : (single?.name || '');
};

const getProductPricing = (product) => {
    const firstSku = product?.skus?.[0];
    const price = firstSku?.price ?? product?.price ?? null;
    const originalPrice = firstSku?.originalPrice ?? product?.originalPrice ?? null;
    const discountLabel = product?.discount || (
        price && originalPrice && originalPrice > price
            ? `${Math.round(((originalPrice - price) / originalPrice) * 100)}% OFF`
            : ''
    );

    return {
        price,
        originalPrice,
        discountLabel
    };
};

const buildDefaultSubcategoriesSection = () => ({
    id: DEFAULT_SUBCATEGORIES_SECTION_ID,
    sectionKind: 'brands',
    isActive: true,
    order: 1,
    title: 'Brands',
    description: 'Auto-fetched from this subcategory',
    sectionLink: '',
    showArrow: false,
    backgroundType: 'color',
    backgroundColor: '#ffffff',
    backgroundImage: '',
    imageRatio: 'square',
    imageWidth: '',
    mediaDisplay: 'grid',
    items: [],
    locked: true
});

const isProductSupportedDisplay = (mediaDisplay) => ['grid', 'scroll'].includes(String(mediaDisplay || '').trim());
const getSupportedDisplayModeOptions = (sectionKind) => {
    const normalizedKind = String(sectionKind || '').trim();
    if (normalizedKind === 'product') {
        return [
            { value: 'scroll', label: 'Scroll' },
            { value: 'grid', label: 'Grid' }
        ];
    }
    if (normalizedKind === 'banner') {
        return [
            { value: 'single', label: 'Single' },
            { value: 'scroll', label: 'Scroll' },
            { value: 'carousel', label: 'Carousel' }
        ];
    }
    return [
        { value: 'scroll', label: 'Scroll' },
        { value: 'grid', label: 'Grid' }
    ];
};

const getDefaultDisplayModeForSectionKind = (sectionKind) => {
    const normalizedKind = String(sectionKind || '').trim();
    if (normalizedKind === 'product') return 'scroll';
    if (normalizedKind === 'banner') return 'single';
    return 'grid';
};

const normalizeDesktopImageItemsPerRow = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '';
    const rounded = Math.round(parsed);
    if (rounded < 1) return '';
    return Math.min(6, rounded);
};

const normalizeDisplayModeForSectionKind = (sectionKind, mediaDisplay) => {
    const normalizedDisplay = String(mediaDisplay || '').trim();
    const allowedOptions = getSupportedDisplayModeOptions(sectionKind);
    if (allowedOptions.some((option) => option.value === normalizedDisplay)) {
        return normalizedDisplay;
    }
    return getDefaultDisplayModeForSectionKind(sectionKind);
};

const enforceSectionItemRules = (items = [], sectionKind = 'image', mediaDisplay = 'single') => {
    const list = Array.isArray(items) ? items : [];
    const normalizedDisplay = String(mediaDisplay || '').trim();
    const normalizedKind = String(sectionKind || '').trim();
    const forcedImageOnly = normalizedDisplay === 'single' || normalizedDisplay === 'carousel';
    const allowedItemType = forcedImageOnly ? 'image' : (normalizedKind === 'product' ? 'product' : 'image');
    let next = list.filter((item) => item?.itemType === allowedItemType);

    if (normalizedDisplay === 'single' && allowedItemType === 'image') {
        next = next.slice(0, 1);
    }

    return next;
};

const isLockedSection = (section) => String(section?.id) === DEFAULT_SUBCATEGORIES_SECTION_ID || section?.locked;

const withDefaultSections = (sections = []) => {
    const shouldIncludeDefaultSubcategories = true;
    const filtered = Array.isArray(sections) ? sections.filter(Boolean) : [];
    const filteredWithoutLocked = shouldIncludeDefaultSubcategories
        ? filtered
        : filtered.filter((section) => !isLockedSection(section));
    const lockedSection = filtered.find((section) => isLockedSection(section));
    const normalized = filteredWithoutLocked.map((section, index) => ({
        ...section,
        desktopImageItemsPerRow: normalizeDesktopImageItemsPerRow(section?.desktopImageItemsPerRow),
        mediaDisplay: isLockedSection(section)
            ? section?.mediaDisplay || 'grid'
            : normalizeDisplayModeForSectionKind(section?.sectionKind, section?.mediaDisplay),
        order: Number(section?.order) || index + 1
    }));

    if (!shouldIncludeDefaultSubcategories) {
        return normalized.map((section, index) => ({ ...section, order: index + 1 }));
    }

    if (!lockedSection) {
        return [buildDefaultSubcategoriesSection(), ...normalized]
            .map((section, index) => ({ ...section, order: index + 1 }));
    }

    const deduped = [];
    let lockedInjected = false;

    normalized.forEach((section) => {
        if (isLockedSection(section)) {
            if (!lockedInjected) {
                deduped.push({ ...buildDefaultSubcategoriesSection(), ...section });
                lockedInjected = true;
            }
            return;
        }
        deduped.push(section);
    });

    if (!lockedInjected) {
        deduped.unshift(buildDefaultSubcategoriesSection());
    }

    return deduped.map((section, index) => ({ ...section, order: index + 1 }));
};

const normalizeCatalogSections = (catalog = []) => (
    (Array.isArray(catalog) ? catalog : []).map((item) => ({
        ...item,
        pageSections: withDefaultSections(item?.pageSections, item?.name)
    }))
);

const SortableWrap = ({ id, children }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    return (
        <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="relative">
            <div className="absolute left-2 top-2 z-10 rounded-lg bg-white/90 p-1 shadow-sm" {...attributes} {...listeners}>
                <MdDragIndicator className="text-gray-400" size={18} />
            </div>
            {children}
        </div>
    );
};

const SubCategoryPageBuilder = () => {
    const categories = useCategoryStore((state) => state.categories);
    const fetchCategories = useCategoryStore((state) => state.fetchCategories);
    const subCategories = useSubCategoryStore((state) => state.subCategories);
    const fetchSubCategories = useSubCategoryStore((state) => state.fetchSubCategories);
    const brands = useBrandStore((state) => state.brands);
    const fetchBrands = useBrandStore((state) => state.fetchBrands);
    const { sectionId: routeSectionId } = useParams();
    const [searchParams] = useSearchParams();
    const [catalog, setCatalog] = useState(() => normalizeCatalogSections(readCategoryPageCatalog()));
    const [categoryId, setCategoryId] = useState(() => {
        if (typeof window === 'undefined') return String(readCategoryPageCatalog()?.[0]?.id || '');
        const savedCategoryId = String(window.localStorage.getItem(SELECTED_CATEGORY_STORAGE_KEY) || '').trim();
        return savedCategoryId || String(readCategoryPageCatalog()?.[0]?.id || '');
    });
    const [sectionId, setSectionId] = useState('');
    const [sectionDirty, setSectionDirty] = useState(false);
    const [layoutDirty, setLayoutDirty] = useState(false);
    const [sectionSaveMessage, setSectionSaveMessage] = useState('');
    const [layoutSaveMessage, setLayoutSaveMessage] = useState('');
    const [isSavingSection, setIsSavingSection] = useState(false);
    const [isUploadingSectionImage, setIsUploadingSectionImage] = useState(false);
    const [draftSection, setDraftSection] = useState(null);
    const [openItems, setOpenItems] = useState({});
    const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
    const [productPickerSearch, setProductPickerSearch] = useState('');
    const [productPickerCategory, setProductPickerCategory] = useState('All');
    const [productPickerSelectedIds, setProductPickerSelectedIds] = useState([]);
    const [selectedParentId, setSelectedParentId] = useState('');
    const [sectionUsesCustomLink, setSectionUsesCustomLink] = useState(false);
    const [itemCustomLinkModes, setItemCustomLinkModes] = useState({});
    const navigate = useNavigate();
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const isSectionFormPage = Boolean(routeSectionId);
    const isCreatingSection = routeSectionId === 'new';
    const requestedCategoryId = String(searchParams.get('categoryId') || '').trim();
    const requestedCategoryName = String(searchParams.get('categoryName') || '').trim().toLowerCase();

    const category = useMemo(() => catalog.find((item) => item.id === categoryId) || catalog[0] || null, [catalog, categoryId]);
    const { products: allProducts = [], loading: productsLoading } = useProducts({ enabled: isSectionFormPage, lite: true });
    const detailedSubCategories = useMemo(() => [], []);
    const existingSection = category?.pageSections?.find((item) => item.id === sectionId) || null;
    const section = isCreatingSection ? draftSection : existingSection;
    const getProduct = (id) => category?.products?.find((item) => item.id === id);
    const hasSelectedSection = Boolean(section);
    const isDefaultSubcategoriesSection = isLockedSection(section);
    const previewSubCategories = useMemo(() => {
        const ordered = getOrderedCategorySubCategories(category, detailedSubCategories);
        const categorySubCategories = Array.isArray(category?.subCategories) ? category.subCategories : [];
        if (categorySubCategories.length === 0) return ordered;

        const allowedIds = new Set(categorySubCategories.map((item) => String(item?.id || item?._id || '').trim()).filter(Boolean));
        const allowedNames = new Set(categorySubCategories.map((item) => normalizeText(item?.name).toLowerCase()).filter(Boolean));

        return ordered.filter((item) => {
            const itemId = String(item?.id || item?._id || '').trim();
            const itemName = normalizeText(item?.name).toLowerCase();
            return (itemId && allowedIds.has(itemId)) || (itemName && allowedNames.has(itemName));
        });
    }, [category, detailedSubCategories]);
    const allPageRouteOptions = useMemo(() => buildPageRouteOptions(categories), [categories]);
    const pageRouteOptions = useMemo(
        () => allPageRouteOptions.filter((option) => normalizeText(option.label).toLowerCase() !== 'for you'),
        [allPageRouteOptions]
    );
    const productRouteOptions = useMemo(
        () => buildProductRouteOptions(category?.products),
        [category]
    );
    const itemLinkOptions = useMemo(
        () => [...pageRouteOptions, ...productRouteOptions],
        [pageRouteOptions, productRouteOptions]
    );

    useEffect(() => {
        if (!categories || categories.length === 0) {
            fetchCategories();
        }
        if (!subCategories || subCategories.length === 0) {
            fetchSubCategories();
        }
        if (!brands || brands.length === 0) {
            fetchBrands();
        }
    }, [categories, fetchCategories, subCategories, fetchSubCategories, brands, fetchBrands]);

    useEffect(() => {
        let active = true;

        readCategoryPageCatalogAsync()
            .then((storedCatalog) => {
                if (!active || !Array.isArray(storedCatalog)) return;
                setCatalog(normalizeCatalogSections(storedCatalog));
            })
            .catch(() => {
                // Keep the sync fallback state if async hydration fails.
            });

        return () => {
            active = false;
        };
    }, []);

    const normalizedSubCategories = useMemo(() => {
        const brandsBySubCategoryId = new Map();

        (Array.isArray(brands) ? brands : []).forEach((brand) => {
            const subId = String(brand?.subcategory?._id || brand?.subcategory || '').trim();
            if (!subId) return;

            const existing = brandsBySubCategoryId.get(subId) || [];
            existing.push({
                id: String(brand?._id || brand?.id || brand?.name || ''),
                name: normalizeText(brand?.name),
                image: normalizeText(brand?.image),
                isActive: brand?.isActive !== false
            });
            brandsBySubCategoryId.set(subId, existing);
        });

        return (Array.isArray(subCategories) ? subCategories : []).map((sub) => {
            const subId = String(sub?._id || sub?.id || '');
            const subName = normalizeText(sub?.name);
            const parent = sub?.category;
            const parentId = String(parent?._id || parent?.id || parent || '');
            const parentName = normalizeText(parent?.name);
            const displayName = parentName ? `${parentName} / ${subName}` : subName;
            const subBrands = (brandsBySubCategoryId.get(subId) || [])
                .filter((item) => item?.name && item?.isActive !== false)
                .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
            return {
                id: subId,
                _id: subId,
                dbId: subId,
                parentId,
                parentName,
                name: displayName || subId,
                subCategories: subBrands,
                children: []
            };
        }).filter((item) => item.name);
    }, [subCategories, brands]);
    const validSubCategoryIds = useMemo(
        () => new Set((normalizedSubCategories || []).map((item) => String(item?.id || '').trim()).filter(Boolean)),
        [normalizedSubCategories]
    );

    const availableCategories = useMemo(() => {
        const catMap = new Map();
        (normalizedSubCategories || []).forEach(sub => {
            if (sub.parentId && sub.parentName) {
                catMap.set(sub.parentId, sub.parentName);
            }
        });
        return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
    }, [normalizedSubCategories]);

    useEffect(() => {
        if (!normalizedSubCategories.length) {
            if (selectedParentId) setSelectedParentId('');
            return;
        }

        const currentSub = normalizedSubCategories.find((sub) => String(sub.id) === String(categoryId));
        const nextParentId = currentSub?.parentId || availableCategories[0]?.id || '';

        if (nextParentId !== selectedParentId) {
            setSelectedParentId(nextParentId);
        }
    }, [availableCategories, categoryId, normalizedSubCategories, selectedParentId]);

    useEffect(() => {
        if (!normalizedSubCategories || normalizedSubCategories.length === 0) {
            setCatalog([]);
            return;
        }

        setCatalog((prev) => {
            const merged = normalizeCatalogSections(
                mergeCategoryPageCatalogWithCategories(prev, normalizedSubCategories)
            );
            // Prevent stale category-level entries from appearing in subcategory builder dropdown.
            return merged.filter((item) => validSubCategoryIds.has(String(item?.id || '').trim()));
        });
    }, [normalizedSubCategories, validSubCategoryIds]);

    useEffect(() => {
        if (!catalog.length) {
            setCategoryId('');
            setSectionId('');
            return;
        }

        if (requestedCategoryId && validSubCategoryIds.has(requestedCategoryId) && requestedCategoryId !== categoryId) {
            setCategoryId(requestedCategoryId);
            return;
        }

        if (requestedCategoryName) {
            const matchedCategory = catalog.find((item) => String(item?.name || '').trim().toLowerCase() === requestedCategoryName);
            if (matchedCategory && matchedCategory.id !== categoryId) {
                setCategoryId(matchedCategory.id);
                return;
            }
        }

        const activeCategory = catalog.find((item) => item.id === categoryId && validSubCategoryIds.has(String(item.id)))
            || catalog.find((item) => validSubCategoryIds.has(String(item.id)))
            || null;
        if (!activeCategory) return;

        if (activeCategory.id !== categoryId) {
            setCategoryId(activeCategory.id);
        }

        if (isCreatingSection) {
            setSectionId('new');
            return;
        }

        if (isSectionFormPage && routeSectionId) {
            if (activeCategory.pageSections.some((item) => item.id === routeSectionId)) {
                if (sectionId !== routeSectionId) {
                    setSectionId(routeSectionId);
                }
                return;
            }
        }

        if (sectionId && activeCategory.pageSections.some((item) => item.id === sectionId)) return;
        setSectionId(activeCategory.pageSections?.[0]?.id || '');
    }, [catalog, categoryId, sectionId, isCreatingSection, isSectionFormPage, requestedCategoryId, requestedCategoryName, routeSectionId, validSubCategoryIds]);

    useEffect(() => {
        if (!isCreatingSection) {
            setDraftSection(null);
            return;
        }

        setDraftSection((current) => current || {
            id: makeId('sec'),
            sectionKind: 'image',
            isActive: true,
            order: (category?.pageSections?.length || 0) + 1,
            title: 'New Section',
            description: '',
            sectionLink: '',
            showArrow: false,
            backgroundType: 'color',
            backgroundColor: '#ffffff',
            backgroundImage: '',
            imageRatio: 'square',
            imageWidth: '',
            desktopImageItemsPerRow: '',
            mediaDisplay: 'grid',
            items: []
        });
        setSectionDirty(true);
    }, [category?.pageSections?.length, isCreatingSection]);

    useEffect(() => {
        if (!section?.items?.length) {
            setOpenItems({});
            setItemCustomLinkModes({});
            return;
        }

        setOpenItems((prev) => {
            const next = {};
            section.items.forEach((item, index) => {
                next[item.id] = prev[item.id] ?? index === 0;
            });
            return next;
        });
    }, [section?.id, section?.items]);

    useEffect(() => {
        setSectionUsesCustomLink(resolveLinkSelectValue(section?.sectionLink, pageRouteOptions) === CUSTOM_LINK_VALUE);
    }, [section?.id, pageRouteOptions]);

    useEffect(() => {
        const nextModes = {};
        (section?.items || []).forEach((item) => {
            nextModes[item.id] = resolveLinkSelectValue(item.link, itemLinkOptions) === CUSTOM_LINK_VALUE;
        });
        setItemCustomLinkModes(nextModes);
    }, [section?.id, itemLinkOptions]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (categoryId) {
            window.localStorage.setItem(SELECTED_CATEGORY_STORAGE_KEY, categoryId);
            return;
        }

        window.localStorage.removeItem(SELECTED_CATEGORY_STORAGE_KEY);
    }, [categoryId]);

    const markDirty = (changeType = 'section') => {
        if (changeType === 'layout') {
            setLayoutDirty(true);
            return;
        }
        setSectionDirty(true);
    };

    const updateCategory = (updater, changeType = 'section') => setCatalog((prev) => {
        const next = prev.map((item) => {
            if (item.id !== categoryId) return item;
            const updated = updater(item);
            return {
                ...updated,
                pageSections: withDefaultSections(updated.pageSections, updated?.name || item?.name)
            };
        });
        markDirty(changeType);
        return next;
    });
    const updateSection = (updates) => {
        if (!section) return;
        if (isCreatingSection) {
            setDraftSection((prev) => (prev ? { ...prev, ...updates } : prev));
            markDirty('section');
            return;
        }
        updateCategory((item) => ({ ...item, pageSections: item.pageSections.map((entry) => entry.id === section.id ? { ...entry, ...updates } : entry) }), 'section');
    };
    const updateItems = (updater) => {
        if (!section) return;
        if (isCreatingSection) {
            setDraftSection((prev) => (prev ? { ...prev, items: updater(prev.items || []) } : prev));
            markDirty('section');
            return;
        }
        updateCategory((item) => ({ ...item, pageSections: item.pageSections.map((entry) => entry.id === section.id ? { ...entry, items: updater(entry.items) } : entry) }), 'section');
    };
    const updateSectionItem = (itemId, updates) => updateItems((items) => items.map((entry) => entry.id === itemId ? { ...entry, ...updates } : entry));
    const handleSectionKindChange = (nextKindRaw) => {
        if (!section) return;
        const requestedKind = String(nextKindRaw || '').trim();
        const nextDisplay = normalizeDisplayModeForSectionKind(requestedKind, section.mediaDisplay);
        const nextItems = enforceSectionItemRules(section.items || [], requestedKind, nextDisplay);
        updateSection({ sectionKind: requestedKind, mediaDisplay: nextDisplay, items: nextItems });
    };
    const handleDisplayModeChange = (nextDisplayRaw) => {
        if (!section) return;
        const nextDisplay = normalizeDisplayModeForSectionKind(section.sectionKind, nextDisplayRaw);
        const nextItems = enforceSectionItemRules(section.items || [], section.sectionKind, nextDisplay);
        updateSection({ mediaDisplay: nextDisplay, items: nextItems });
    };
    const displayModeOptions = getSupportedDisplayModeOptions(section?.sectionKind);
    const selectedDisplayMode = normalizeDisplayModeForSectionKind(section?.sectionKind, section?.mediaDisplay);
    const updateSubCategoryOrder = (orderedIds = []) => {
        updateCategory((item) => {
            const currentSubCategories = Array.isArray(item.subCategories) ? item.subCategories : [];
            const subCategoryMap = new Map(currentSubCategories.map((subCategory) => [String(subCategory.id || subCategory._id || subCategory.name), subCategory]));
            const reorderedSubCategories = orderedIds
                .map((id) => subCategoryMap.get(String(id)))
                .filter(Boolean);
            const remainingSubCategories = currentSubCategories.filter((subCategory) => {
                const key = String(subCategory.id || subCategory._id || subCategory.name);
                return !orderedIds.some((orderedId) => String(orderedId) === key);
            });
            const nextSubCategories = [...reorderedSubCategories, ...remainingSubCategories];

            const stripItems = Array.isArray(item.categoryStrip?.items) ? item.categoryStrip.items : [];
            const stripItemMap = new Map(stripItems.map((stripItem) => [String(stripItem.subCategoryId), stripItem]));
            const reorderedStripItems = nextSubCategories.map((subCategory, index) => {
                const key = String(subCategory.id || subCategory._id || subCategory.name);
                const existingStripItem = stripItemMap.get(key);
                return existingStripItem
                    ? { ...existingStripItem, order: index + 1 }
                    : { id: `strip-${key}`, subCategoryId: key, isActive: true, order: index + 1 };
            });

            return {
                ...item,
                subCategories: nextSubCategories,
                categoryStrip: {
                    ...(item.categoryStrip || {}),
                    isActive: item.categoryStrip?.isActive !== false,
                    items: reorderedStripItems
                }
            };
        }, 'layout');
    };
    const uploadCategoryPageImage = async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        const { data } = await API.post('/settings/category-page-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return String(data?.imageUrl || '').trim();
    };

    const handleSectionItemImageUpload = async (itemId, file) => {
        if (!file) return;
        setIsUploadingSectionImage(true);
        setSectionSaveMessage('Uploading image...');
        try {
            const imageUrl = await uploadCategoryPageImage(file);
            if (!imageUrl) throw new Error('Upload failed');
            updateSectionItem(itemId, { image: imageUrl });
            setSectionSaveMessage('Image uploaded');
            window.setTimeout(() => setSectionSaveMessage(''), 1500);
        } catch {
            setSectionSaveMessage('Image upload failed');
            window.setTimeout(() => setSectionSaveMessage(''), 1800);
        } finally {
            setIsUploadingSectionImage(false);
        }
    };
    const handleBackgroundImageUpload = async (file) => {
        if (!section || !file) return;
        setIsUploadingSectionImage(true);
        setSectionSaveMessage('Uploading image...');
        try {
            const imageUrl = await uploadCategoryPageImage(file);
            if (!imageUrl) throw new Error('Upload failed');
            updateSection({ backgroundImage: imageUrl });
            setSectionSaveMessage('Image uploaded');
            window.setTimeout(() => setSectionSaveMessage(''), 1500);
        } catch {
            setSectionSaveMessage('Image upload failed');
            window.setTimeout(() => setSectionSaveMessage(''), 1800);
        } finally {
            setIsUploadingSectionImage(false);
        }
    };

    const onSectionDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        updateCategory((item) => {
            const oldIndex = item.pageSections.findIndex((entry) => entry.id === active.id);
            const newIndex = item.pageSections.findIndex((entry) => entry.id === over.id);
            return { ...item, pageSections: withDefaultSections(arrayMove(item.pageSections, oldIndex, newIndex), item?.name) };
        }, 'layout');
    };

    const onItemDragEnd = ({ active, over }) => {
        if (!section || !over || active.id === over.id) return;
        updateItems((items) => {
            const oldIndex = items.findIndex((entry) => entry.id === active.id);
            const newIndex = items.findIndex((entry) => entry.id === over.id);
            return arrayMove(items, oldIndex, newIndex);
        });
    };
    const onSubCategoryDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const ids = previewSubCategories.map((item) => String(item.id || item._id || item.name));
        const oldIndex = ids.findIndex((id) => id === String(active.id));
        const newIndex = ids.findIndex((id) => id === String(over.id));
        if (oldIndex < 0 || newIndex < 0) return;
        const nextIds = arrayMove(ids, oldIndex, newIndex);
        updateSubCategoryOrder(nextIds);
    };

    const selectedBackgroundType = section?.backgroundType || (section?.backgroundImage ? 'image' : 'color');

    const previewItems = section
        ? (section.mediaDisplay === 'single' ? section.items.slice(0, 1) : section.items)
        : [];
    const selectedProductIds = new Set(
        (section?.items || [])
            .filter((item) => item.itemType === 'product' && item.productId)
            .map((item) => item.productId)
    );
    const productPickerCategoryOptions = useMemo(() => {
        const optionSet = new Set(['All']);
        (categories || []).forEach((item) => {
            const name = normalizeText(item?.name);
            if (name) optionSet.add(name);
        });
        (allProducts || []).forEach((product) => {
            const label = normalizeText(getProductCategoryLabel(product));
            if (label && label !== 'Uncategorized') optionSet.add(label);
        });
        return Array.from(optionSet);
    }, [allProducts, categories]);

    const filteredPickerProducts = useMemo(() => {
        const searchValue = normalizeText(productPickerSearch).toLowerCase();
        return (allProducts || []).filter((product) => {
            const categoryLabel = normalizeText(getProductCategoryLabel(product));
            const name = normalizeText(product?.name).toLowerCase();
            const subtitle = normalizeText(getProductSubtitle(product)).toLowerCase();
            const categoryMatches = productPickerCategory === 'All' || categoryLabel.toLowerCase() === productPickerCategory.toLowerCase();
            const searchMatches = !searchValue || name.includes(searchValue) || subtitle.includes(searchValue);
            return categoryMatches && searchMatches;
        });
    }, [allProducts, productPickerCategory, productPickerSearch]);

    const openProductPicker = () => {
        if (!section) return;
        if (!isProductSupportedDisplay(section.mediaDisplay) || section.sectionKind !== 'product') return;
        setProductPickerSelectedIds(Array.from(selectedProductIds));
        setProductPickerSearch('');
        setProductPickerCategory(normalizeText(category?.name) || 'All');
        setIsProductPickerOpen(true);
    };

    const closeProductPicker = () => {
        setIsProductPickerOpen(false);
    };

    const toggleProductPickerSelection = (productId) => {
        setProductPickerSelectedIds((prev) => {
            const next = new Set(prev.map((id) => String(id)));
            const normalizedId = String(productId);
            if (next.has(normalizedId)) next.delete(normalizedId);
            else next.add(normalizedId);
            return Array.from(next);
        });
    };

    const applyPickedProducts = () => {
        if (!section || !isProductSupportedDisplay(section.mediaDisplay) || section.sectionKind !== 'product') {
            setIsProductPickerOpen(false);
            return;
        }
        const selectedIds = productPickerSelectedIds.map((id) => String(id));
        const selectedProductMap = new Map(
            (allProducts || [])
                .map((product) => [getProductId(product), product])
                .filter(([id]) => id)
        );

        const buildNextItems = (items = []) => {
            const existingProductMap = new Map(
                (items || [])
                    .filter((row) => row.itemType === 'product' && row.productId)
                    .map((row) => [String(row.productId), row])
            );
            const nonProductItems = (items || []).filter((row) => row.itemType !== 'product');
            const nextProductItems = selectedIds.map((pid) => {
                const existing = existingProductMap.get(pid);
                const selectedProduct = selectedProductMap.get(pid);
                const snapshot = selectedProduct ? {
                    id: getProductId(selectedProduct),
                    name: String(selectedProduct?.name || '').trim(),
                    image: String(selectedProduct?.image || '').trim(),
                    subtitle: getProductSubtitle(selectedProduct)
                } : null;

                return existing ? {
                    ...existing,
                    productSnapshot: snapshot || existing.productSnapshot || null
                } : {
                    id: makeId('item'),
                    itemType: 'product',
                    productId: pid,
                    productSnapshot: snapshot,
                    title: '',
                    description: '',
                    link: ''
                };
            });

            const merged = [...nonProductItems, ...nextProductItems];
            return enforceSectionItemRules(merged, section.sectionKind, section.mediaDisplay);
        };

        if (isCreatingSection) {
            setDraftSection((prev) => (prev ? { ...prev, items: buildNextItems(prev.items || []) } : prev));
        } else {
            updateItems((items) => buildNextItems(items));
        }

        setCatalog((prev) => prev.map((entry) => {
            if (entry.id !== categoryId) return entry;

            const existingProducts = Array.isArray(entry.products) ? entry.products : [];
            const mergedProducts = new Map(existingProducts.map((product) => [getProductId(product), product]).filter(([id]) => id));
            selectedIds.forEach((id) => {
                const selectedProduct = selectedProductMap.get(id);
                if (selectedProduct) mergedProducts.set(id, selectedProduct);
            });

            return {
                ...entry,
                products: Array.from(mergedProducts.values())
            };
        }));

        setSectionDirty(true);
        setSectionSaveMessage('Products added');
        window.setTimeout(() => setSectionSaveMessage(''), 1800);
        setIsProductPickerOpen(false);
    };

    const saveBuilderState = async (successMessage, type = 'section') => {
        if (!category) return;
        try {
            const nextCatalog = isCreatingSection && draftSection
                ? catalog.map((item) => {
                    if (item.id !== categoryId) return item;
                    return {
                        ...item,
                        pageSections: withDefaultSections([...(item.pageSections || []), draftSection], item?.name)
                    };
                })
                : catalog;
            if (isCreatingSection && draftSection) {
                setCatalog(nextCatalog);
            }
            await writeCategoryPageCatalog(nextCatalog);
            setSectionDirty(false);
            setLayoutDirty(false);
            if (type === 'layout') {
                setLayoutSaveMessage(successMessage);
                setSectionSaveMessage('');
                window.setTimeout(() => setLayoutSaveMessage(''), 1800);
            } else {
                setSectionSaveMessage(successMessage);
                setLayoutSaveMessage('');
                window.setTimeout(() => setSectionSaveMessage(''), 1800);
                navigate(`/admin/subcategories/page-builder?categoryId=${encodeURIComponent(categoryId)}`, { replace: true });
            }
        } catch {
            if (type === 'layout') {
                setLayoutSaveMessage('Save failed');
                window.setTimeout(() => setLayoutSaveMessage(''), 1800);
            } else {
                setSectionSaveMessage('Save failed');
                window.setTimeout(() => setSectionSaveMessage(''), 1800);
            }
        }
    };

    const handleSaveSection = async () => {
        if (isSavingSection) return;
        setIsSavingSection(true);
        try {
            await saveBuilderState('Section saved', 'section');
        } finally {
            setIsSavingSection(false);
        }
    };

    const handleSaveLayout = async () => {
        await saveBuilderState('Order saved', 'layout');
    };

    const handleOpenSectionForm = (targetSectionId) => {
        if (!targetSectionId || !category?.id) return;
        navigate(`/admin/subcategories/page-builder/section/${targetSectionId}?categoryId=${encodeURIComponent(category.id)}`);
    };

    const handleCreateSection = () => {
        if (!category) return;
        navigate(`/admin/subcategories/page-builder/section/new?categoryId=${encodeURIComponent(category.id)}`);
    };

    const handleDiscardSection = () => {
        setDraftSection(null);
        setSectionDirty(false);
        setSectionSaveMessage('');
        navigate('/admin/subcategories/page-builder');
    };

    const toggleItemOpen = (itemId) => {
        setOpenItems((prev) => ({
            ...prev,
            [itemId]: !prev[itemId]
        }));
    };

    if (!category) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-sm font-medium text-gray-600 shadow-sm">
                No subcategories found. Create a subcategory first, then build its landing page.
            </div>
        );
    }

    return (
        <div className="min-w-0 space-y-6">
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                                    <h1 className="text-2xl font-bold text-gray-800">{isSectionFormPage ? 'Section Form' : 'Subcategory Page Sections'}</h1>
                    <p className="text-sm text-gray-500">
                        {isSectionFormPage
                            ? 'Edit one section on its own page and save the changes.'
                            : 'Manage page sections here and open a separate section form page for add/edit.'}
                    </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Category</span>
                        <select
                            value={selectedParentId}
                            onChange={(e) => {
                                const nextParentId = e.target.value;
                                setSelectedParentId(nextParentId);
                                // Automatically select the first subcategory in this category
                                const firstSub = normalizedSubCategories.find(s => s.parentId === nextParentId);
                                if (firstSub) {
                                    setCategoryId(firstSub.id);
                                    setSectionId('');
                                    navigate(`/admin/subcategories/page-builder?categoryId=${encodeURIComponent(firstSub.id)}`, { replace: true });
                                }
                            }}
                            className="max-w-[200px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none"
                        >
                            {!selectedParentId && <option value="">Select Category</option>}
                            {availableCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Subcategory</span>
                        <select
                            value={categoryId}
                            onChange={(e) => {
                                const nextCategoryId = e.target.value;
                                const nextSub = normalizedSubCategories.find((sub) => String(sub.id) === String(nextCategoryId));
                                if (nextSub?.parentId && nextSub.parentId !== selectedParentId) {
                                    setSelectedParentId(nextSub.parentId);
                                }
                                setCategoryId(nextCategoryId);
                                setSectionId('');
                                navigate(`/admin/subcategories/page-builder?categoryId=${encodeURIComponent(nextCategoryId)}`, { replace: true });
                            }}
                            className="max-w-[200px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 outline-none"
                        >
                            {catalog
                                .filter(item => {
                                    const sub = normalizedSubCategories.find(s => String(s.id) === String(item.id));
                                    return !selectedParentId || sub?.parentId === selectedParentId;
                                })
                                .map((item) => {
                                    const sub = (subCategories || []).find((entry) => (
                                        String(entry?._id || entry?.id || '') === String(item.id)
                                    ));
                                    const subName = normalizeText(sub?.name) || normalizeText(item?.name);
                                    return <option key={item.id} value={item.id}>{subName}</option>;
                                })}
                        </select>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700">Dynamic Builder</div>
                </div>
            </div>

            <div className={`min-w-0 grid gap-6 ${isSectionFormPage ? '' : 'xl:grid-cols-[440px_minmax(0,1fr)]'}`}>
                {!isSectionFormPage && (
                <div className="space-y-6">
                    <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-widest text-gray-800">Page Sections</h2>
                                <p className="mt-1 text-xs text-gray-500">One reusable section container</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveLayout}
                                    disabled={!category}
                                    className={`rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide ${
                                        category ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    }`}
                                >
                                    Save Order
                                </button>
                                <button type="button" onClick={handleCreateSection} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white"><MdAdd size={18} />Add Section</button>
                            </div>
                        </div>
                        {category && (
                            <p className={`mb-3 text-[11px] font-semibold ${layoutSaveMessage ? 'text-green-700' : layoutDirty ? 'text-amber-600' : 'text-gray-400'}`}>
                                {layoutSaveMessage || (layoutDirty ? 'Order changes pending' : 'Order saved')}
                            </p>
                        )}
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
                            <SortableContext items={category.pageSections.map((item) => item.id)} strategy={rectSortingStrategy}>
                                <div className="space-y-3">
                                    {category.pageSections.map((item) => <SortableWrap key={item.id} id={item.id}>
                                        <button type="button" onClick={() => handleOpenSectionForm(item.id)} className={`w-full rounded-2xl border px-4 py-3 pl-12 text-left transition ${section?.id === item.id ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'}`}>
                                            <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                    <div className="text-lg font-bold tracking-tight text-gray-900">{item.title || 'Untitled Section'}</div>
                                                    <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500"><span>{item.sectionKind}</span><span>{item.mediaDisplay}</span><span>{isLockedSection(item) ? previewSubCategories.length : item.items.length} items</span></div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!isLockedSection(item) && (
                                                        <span onClick={(e) => { e.stopPropagation(); updateCategory((entry) => ({ ...entry, pageSections: entry.pageSections.map((row) => row.id === item.id ? { ...row, isActive: !row.isActive } : row) }), 'layout'); }} className={item.isActive ? 'text-green-600' : 'text-gray-400'}>{item.isActive ? <MdToggleOn size={26} /> : <MdToggleOff size={26} />}</span>
                                                    )}
                                                    {!isLockedSection(item) ? (
                                                        <span onClick={(e) => { e.stopPropagation(); updateCategory((entry) => ({ ...entry, pageSections: entry.pageSections.filter((row) => row.id !== item.id).map((row, index) => ({ ...row, order: index + 1 })) }), 'layout'); }} className="text-red-500"><MdDelete size={18} /></span>
                                                    ) : (
                                                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">Locked</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    </SortableWrap>)}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </div>
                </div>
                )}

                {isSectionFormPage && (
                <div className="min-w-0 space-y-6">
                    <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Section Editor</h2>
                                <p className="mt-1 text-sm text-gray-500">This saved content is what the user subcategory landing page will render.</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleDiscardSection}
                                        disabled={isSavingSection || isUploadingSectionImage}
                                        className={`rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                                            (isSavingSection || isUploadingSectionImage)
                                                ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        Discard Section
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveSection}
                                        disabled={!category || isSavingSection || isUploadingSectionImage}
                                        className={`rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide ${
                                            category && !isSavingSection && !isUploadingSectionImage
                                                ? 'bg-primary-600 text-white hover:bg-primary-700'
                                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        }`}
                                    >
                                        {isSavingSection ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/70 border-t-white" />
                                                Saving...
                                            </span>
                                        ) : 'Save Section'}
                                    </button>
                                </div>
                                {category && (
                                    <p className={`text-[11px] font-semibold ${sectionSaveMessage ? 'text-green-700' : sectionDirty ? 'text-amber-600' : 'text-gray-400'}`}>
                                        {sectionSaveMessage || (sectionDirty ? 'Section changes pending' : 'Section saved')}
                                    </p>
                                )}
                            </div>
                        </div>
                        {!hasSelectedSection ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm font-medium text-gray-600">
                                This section could not be found for the selected subcategory.
                            </div>
                        ) : isDefaultSubcategoriesSection ? (
                            <div className="rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-900">
                                This is a default system section. It automatically fetches all brands for the selected subcategory and cannot be deleted.
                            </div>
                        ) : (
                        <div className="min-w-0 grid gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm font-semibold text-gray-700"><span>Heading</span><input value={section.title} onChange={(e) => updateSection({ title: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none" /></label>
                            <label className="space-y-2 text-sm font-semibold text-gray-700"><span>Paragraph</span><input value={section.description} onChange={(e) => updateSection({ description: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none" /></label>
                            <label className="space-y-2 text-sm font-semibold text-gray-700">
                                <span>Section Kind</span>
                                <select
                                    value={section.sectionKind}
                                    onChange={(e) => handleSectionKindChange(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
                                >
                                    <option value="image">Image</option>
                                    <option value="banner">Banner</option>
                                    <option value="product">Product</option>
                                </select>
                            </label>
                            <label className="space-y-2 text-sm font-semibold text-gray-700">
                                <span>Display Mode</span>
                                <select
                                    value={selectedDisplayMode || 'single'}
                                    onChange={(e) => handleDisplayModeChange(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
                                >
                                    {displayModeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            {((section.sectionKind === 'image' && !['single', 'carousel'].includes(String(section.mediaDisplay || '').trim()))
                                || (section.sectionKind === 'banner' && section.mediaDisplay === 'scroll')) && (
                                <div className="grid grid-cols-1 gap-3 md:col-span-2">
                                    <label className="space-y-2 text-sm font-semibold text-gray-700">
                                        <span>Image Width (px)</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={section.imageWidth || ''}
                                            onChange={(e) => updateSection({ imageWidth: e.target.value.replace(/[^\d]/g, '') })}
                                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none"
                                            placeholder="e.g. 320"
                                        />
                                    </label>
                                    <p className="text-xs text-gray-500">
                                        {section.sectionKind === 'banner'
                                            ? 'Banner scroll me width apply hogi. Single aur carousel me banner full width hi rahega.'
                                            : 'Height image ke natural ratio ke hisaab se width ke according auto-adjust hogi.'}
                                    </p>
                                </div>
                            )}
                            {section.sectionKind === 'image' && section.mediaDisplay === 'grid' && (
                                <div className="grid grid-cols-1 gap-3 md:col-span-2">
                                    <label className="space-y-2 text-sm font-semibold text-gray-700">
                                        <span>Desktop Photos Per Row</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="6"
                                            value={section.desktopImageItemsPerRow || ''}
                                            onChange={(e) => updateSection({ desktopImageItemsPerRow: e.target.value.replace(/[^\d]/g, '') })}
                                            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none"
                                            placeholder="e.g. 3"
                                        />
                                    </label>
                                    <p className="text-xs text-gray-500">
                                        Sirf web/desktop par image grid ke liye apply hoga. Mobile layout same rahega.
                                    </p>
                                </div>
                            )}
                            <label className="space-y-2 text-sm font-semibold text-gray-700">
                                <span>Background Type</span>
                                <select
                                    value={selectedBackgroundType}
                                    onChange={(e) => updateSection({ backgroundType: e.target.value })}
                                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
                                >
                                    <option value="color">Color</option>
                                    <option value="image">Image</option>
                                </select>
                            </label>
                            {selectedBackgroundType === 'color' ? (
                                <label className="space-y-2 text-sm font-semibold text-gray-700">
                                    <span>Background Color</span>
                                    <input
                                        value={section.backgroundColor}
                                        onChange={(e) => updateSection({ backgroundColor: e.target.value, backgroundImage: '' })}
                                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none"
                                    />
                                </label>
                            ) : (
                                <label className="space-y-2 text-sm font-semibold text-gray-700">
                                    <span>Background Image</span>
                                    <input
                                        id={`section-bg-upload-${section.id}`}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleBackgroundImageUpload(e.target.files?.[0])}
                                        className="hidden"
                                    />
                                    {!section.backgroundImage && (
                                        <label
                                            htmlFor={`section-bg-upload-${section.id}`}
                                            className="inline-flex cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                            Upload background image
                                        </label>
                                    )}
                                    {section.backgroundImage ? (
                                        <div className="space-y-2">
                                            <div className="h-24 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                                                <img src={section.backgroundImage} alt="Background preview" className="h-full w-full object-cover" />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => updateSection({ backgroundImage: '' })}
                                                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                            >
                                                Remove image
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500">Upload image from local system.</p>
                                    )}
                                </label>
                            )}
                            {section.showArrow && (
                                <>
                                    <label className="space-y-2 text-sm font-semibold text-gray-700">
                                        <span>Section Link</span>
                                        <select
                                            value={sectionUsesCustomLink ? CUSTOM_LINK_VALUE : resolveLinkSelectValue(section.sectionLink, pageRouteOptions)}
                                            onChange={(e) => {
                                                const nextValue = e.target.value;
                                                if (nextValue === CUSTOM_LINK_VALUE) {
                                                    setSectionUsesCustomLink(true);
                                                    return;
                                                }
                                                if (nextValue === SELECT_LINK_VALUE) {
                                                    setSectionUsesCustomLink(false);
                                                    updateSection({ sectionLink: '' });
                                                    return;
                                                }
                                                setSectionUsesCustomLink(false);
                                                updateSection({ sectionLink: nextValue });
                                            }}
                                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
                                        >
                                            <option value={SELECT_LINK_VALUE}>Select link</option>
                                            <option value={CUSTOM_LINK_VALUE}>Custom Link</option>
                                            {pageRouteOptions.map((option) => (
                                                <option key={option.value} value={option.value}>{option.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    {sectionUsesCustomLink && (
                                        <label className="space-y-2 text-sm font-semibold text-gray-700">
                                            <span>Custom Section URL</span>
                                            <input
                                                value={section.sectionLink}
                                                onChange={(e) => updateSection({ sectionLink: e.target.value })}
                                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none"
                                                placeholder="/category/Mobiles/VIVO"
                                            />
                                        </label>
                                    )}
                                </>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <button type="button" onClick={() => updateSection({ isActive: !section.isActive })} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${section.isActive ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-600'}`}>{section.isActive ? 'Section Active' : 'Section Inactive'}</button>
                                <button type="button" onClick={() => updateSection({ showArrow: !section.showArrow })} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${section.showArrow ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-600'}`}>{section.showArrow ? 'Arrow On' : 'Arrow Off'}</button>
                            </div>
                        </div>
                        )}
                    </div>

                    <div className="min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm overflow-hidden">
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-base font-bold text-gray-900">Section Items</h3>
                                <p className="mt-1 text-sm text-gray-500">Image ya product source dono same section ke andar.</p>
                            </div>
                            {!hasSelectedSection || isDefaultSubcategoriesSection ? null : section.sectionKind !== 'product' ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (section.mediaDisplay === 'single' && (section.items || []).filter((item) => item.itemType === 'image').length >= 1) return;
                                        updateItems((items) => [...items, { id: makeId('item'), itemType: 'image', image: '', title: '', description: '', link: '' }]);
                                    }}
                                    disabled={section.mediaDisplay === 'single' && (section.items || []).filter((item) => item.itemType === 'image').length >= 1}
                                    className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                                        section.mediaDisplay === 'single' && (section.items || []).filter((item) => item.itemType === 'image').length >= 1
                                            ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                                            : 'bg-primary-600 text-white'
                                    }`}
                                >
                                    <MdAdd size={18} />Add Image
                                </button>
                            ) : (
                                <button type="button" onClick={openProductPicker} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-semibold text-white"><MdAdd size={18} />Add Product</button>
                            )}
                        </div>
                        {!hasSelectedSection ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm font-medium text-gray-600">
                                Select a section to manage items.
                            </div>
                        ) : isDefaultSubcategoriesSection ? (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSubCategoryDragEnd}>
                                <SortableContext items={previewSubCategories.map((item) => String(item.id || item._id || item.name))} strategy={rectSortingStrategy}>
                                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                        {previewSubCategories.map((item, index) => (
                                            <SortableWrap key={item.id || item._id || item.name} id={String(item.id || item._id || item.name)}>
                                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 pl-10">
                                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                        <div>
                                                            <div className="text-[13px] font-bold leading-tight text-gray-900">Brand {index + 1}</div>
                                                            <div className="text-[10px] uppercase tracking-wide text-gray-500">Auto-fetched</div>
                                                        </div>
                                                        <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700">Drag</span>
                                                    </div>
                                                    <div className="overflow-hidden rounded-lg bg-white">
                                                        {item.image ? (
                                                            <img src={item.image} alt={item.name} className="h-20 w-full object-cover" />
                                                        ) : (
                                                            <div className="h-20 w-full bg-gray-100" />
                                                        )}
                                                    </div>
                                                    <div className="pt-2 text-[13px] font-semibold leading-tight text-gray-900">{item.name}</div>
                                                </div>
                                            </SortableWrap>
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        ) : (
                        <>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd}>
                            <SortableContext items={section.items.map((item) => item.id)} strategy={rectSortingStrategy}>
                                <div className="min-w-0 space-y-4">
                                    {section.items.map((item, index) => {
                                        const product = item.itemType === 'product' ? (getProduct(item.productId) || item.productSnapshot) : null;
                                        const isItemOpen = Boolean(openItems[item.id]);
                                        return <SortableWrap key={item.id} id={item.id}>
                                            <div className="min-w-0 rounded-2xl border border-gray-100 bg-gray-50 p-4 pl-10 overflow-hidden">
                                                <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleItemOpen(item.id)}
                                                        className="flex min-w-0 items-center gap-2 text-left"
                                                    >
                                                        <MdArrowDropDown size={22} className={`text-gray-500 transition-transform ${isItemOpen ? 'rotate-0' : '-rotate-90'}`} />
                                                        <div className="min-w-0"><div className="text-sm font-bold text-gray-900">Item {index + 1}</div><div className="text-xs uppercase tracking-wider text-gray-500">{item.itemType}</div></div>
                                                    </button>
                                                    <button type="button" onClick={() => updateItems((items) => items.filter((row) => row.id !== item.id))} className="shrink-0 text-red-500"><MdDelete size={18} /></button>
                                                </div>
                                                {isItemOpen && (item.itemType === 'image' ? (
                                                    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                                                        <div className="min-w-0 space-y-2">
                                                            <input
                                                                id={`section-item-image-${item.id}`}
                                                                type="file"
                                                                accept="image/*"
                                                                onChange={(e) => handleSectionItemImageUpload(item.id, e.target.files?.[0])}
                                                                className="hidden"
                                                            />
                                                            {!item.image && (
                                                                <label
                                                                    htmlFor={`section-item-image-${item.id}`}
                                                                    className="inline-flex max-w-full cursor-pointer items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    Upload image
                                                                </label>
                                                            )}
                                                            {item.image ? (
                                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                                                                        <img src={item.image} alt="Item preview" className="h-full w-full object-cover" />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateSectionItem(item.id, { image: '' })}
                                                                        className="inline-flex max-w-full items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                                    >
                                                                        Remove image
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-gray-500">Upload image from local system.</p>
                                                            )}
                                                        </div>
                                                        <input value={item.title || ''} onChange={(e) => updateSectionItem(item.id, { title: e.target.value })} className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none" placeholder="Title" />
                                                        <input value={item.description || ''} onChange={(e) => updateSectionItem(item.id, { description: e.target.value })} className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none" placeholder="Description" />
                                                        <label className="min-w-0 space-y-2 lg:col-span-2">
                                                            <span className="block text-sm font-semibold text-gray-700">Item Link</span>
                                                            <select
                                                                value={itemCustomLinkModes[item.id] ? CUSTOM_LINK_VALUE : resolveLinkSelectValue(item.link, itemLinkOptions)}
                                                                onChange={(e) => {
                                                                    const nextValue = e.target.value;
                                                                    if (nextValue === CUSTOM_LINK_VALUE) {
                                                                        setItemCustomLinkModes((prev) => ({ ...prev, [item.id]: true }));
                                                                        return;
                                                                    }
                                                                    if (nextValue === SELECT_LINK_VALUE) {
                                                                        setItemCustomLinkModes((prev) => ({ ...prev, [item.id]: false }));
                                                                        updateSectionItem(item.id, { link: '' });
                                                                        return;
                                                                    }
                                                                    setItemCustomLinkModes((prev) => ({ ...prev, [item.id]: false }));
                                                                    updateSectionItem(item.id, { link: nextValue });
                                                                }}
                                                                className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
                                                            >
                                                                <option value={SELECT_LINK_VALUE}>Select link</option>
                                                                <option value={CUSTOM_LINK_VALUE}>Custom Link</option>
                                                                {itemLinkOptions.map((option) => (
                                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                        {itemCustomLinkModes[item.id] && (
                                                            <label className="min-w-0 space-y-2 lg:col-span-2">
                                                                <span className="block text-sm font-semibold text-gray-700">Custom Item URL</span>
                                                                <input
                                                                    value={item.link || ''}
                                                                    onChange={(e) => updateSectionItem(item.id, { link: e.target.value })}
                                                                    className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
                                                                    placeholder="/category/Mobiles/VIVO"
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                                                        <div className="min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800">
                                                            {product ? product.name : 'No product selected'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </SortableWrap>;
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                        </>
                        )}
                    </div>

                </div>
                )}
            </div>

        {isSectionFormPage && (
            <SectionPreviewCard
                hasSelectedSection={hasSelectedSection}
                section={section}
                selectedBackgroundType={selectedBackgroundType}
                isDefaultSubcategoriesSection={isDefaultSubcategoriesSection}
                previewSubCategories={previewSubCategories}
                previewItems={previewItems}
                getProduct={getProduct}
            />
        )}
            <ProductPickerModal
                isOpen={isProductPickerOpen}
                onClose={closeProductPicker}
                categoryOptions={productPickerCategoryOptions}
                filterCategory={productPickerCategory}
                onFilterCategoryChange={setProductPickerCategory}
                searchTerm={productPickerSearch}
                onSearchTermChange={setProductPickerSearch}
                products={filteredPickerProducts}
                selectedIds={new Set(productPickerSelectedIds.map((id) => String(id)))}
                onToggle={toggleProductPickerSelection}
                onApply={applyPickedProducts}
                loading={productsLoading}
            />
        </div>
    );
};

const ProductPickerModal = ({
    isOpen,
    onClose,
    categoryOptions,
    filterCategory,
    onFilterCategoryChange,
    searchTerm,
    onSearchTermChange,
    products,
    selectedIds,
    onToggle,
    onApply,
    loading
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
            <div className="flex h-[min(88vh,760px)] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Add Products</h3>
                        <p className="mt-1 text-sm text-gray-500">Filter by category, select multiple products, and add them without leaving this page.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
                        aria-label="Close product picker"
                    >
                        <MdClose size={20} />
                    </button>
                </div>

                <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 md:flex-row md:items-center">
                    <div className="relative min-w-0 flex-1">
                        <MdSearch size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => onSearchTermChange(e.target.value)}
                            placeholder="Search products by name"
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-primary-300 focus:bg-white"
                        />
                    </div>
                    <select
                        value={filterCategory}
                        onChange={(e) => onFilterCategoryChange(e.target.value)}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 outline-none"
                    >
                        {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <div className="rounded-full bg-primary-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary-700">
                        {selectedIds.size} selected
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                    {loading ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                            Loading products...
                        </div>
                    ) : products.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                            No products found for the current filters.
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {products.map((product) => {
                                const productId = getProductId(product);
                                const isSelected = selectedIds.has(productId);
                                const categoryLabel = getProductCategoryLabel(product);
                                const subtitle = getProductSubtitle(product);

                                return (
                                    <button
                                        key={productId}
                                        type="button"
                                        onClick={() => onToggle(productId)}
                                        className={`min-w-0 overflow-hidden rounded-2xl border text-left transition ${
                                            isSelected
                                                ? 'border-primary-500 bg-primary-50 shadow-[0_18px_40px_-24px_rgba(37,99,235,0.55)]'
                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                                        }`}
                                    >
                                        <div className="aspect-[4/3] max-h-[190px] overflow-hidden bg-gray-100">
                                            {product?.image ? (
                                                <img src={product.image} alt={product?.name || 'Product'} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full bg-gray-100" />
                                            )}
                                        </div>
                                        <div className="space-y-1.5 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-bold text-gray-900 md:text-[15px]">{product?.name || 'Untitled product'}</div>
                                                    <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{categoryLabel}</div>
                                                </div>
                                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${isSelected ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                    {isSelected ? 'Selected' : 'Select'}
                                                </span>
                                            </div>
                                            {subtitle ? <p className="line-clamp-2 text-xs text-gray-500">{subtitle}</p> : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
                    <p className="text-sm text-gray-500">Selected products will be added to this section here only.</p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onApply}
                            className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
                        >
                            Add Selected
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const getAdminPreviewImageCardStyle = (section, mediaDisplay) => {
    const width = Number(section?.imageWidth);
    if (!Number.isFinite(width) || width <= 0) {
        return mediaDisplay === 'scroll' ? { width: 'calc((100% - 1rem) / 2)' } : undefined;
    }

    if (mediaDisplay === 'scroll') {
        if (section?.sectionKind === 'banner') {
            return { width: `min(${width}px, calc((100vw - 8rem) / 1.35))` };
        }
        return { width: `min(${width}px, calc((100% - 1.5rem) / 2), 180px)` };
    }

    if (mediaDisplay === 'grid') {
        if (section?.sectionKind === 'image' && normalizeDesktopImageItemsPerRow(section?.desktopImageItemsPerRow)) {
            return { width: `${width}px`, justifySelf: 'start' };
        }
        return { width: '100%', maxWidth: `min(${width}px, calc((100% - 1.5rem) / 2), 180px)`, marginInline: 'auto' };
    }

    return undefined;
};

const getAdminPreviewProductCardClass = (mediaDisplay) => {
    if (mediaDisplay === 'single') return 'w-full max-w-sm';
    if (mediaDisplay === 'grid') return 'w-full min-w-0';
    return 'w-[calc((100%-1rem)/2)] min-w-[calc((100%-1rem)/2)] shrink-0 md:w-[calc((100%-2.5rem)/3)] md:min-w-[calc((100%-2.5rem)/3)] xl:w-[calc((100%-3rem)/4)] xl:min-w-[calc((100%-3rem)/4)]';
};

const AdminPreviewItemCard = ({ item, mediaDisplay, getProduct, section }) => {
    const product = item?.itemType === 'product' ? (getProduct(item.productId) || item.productSnapshot) : null;
    const image = item?.itemType === 'product' ? product?.image : item?.image;
    const title = item?.title || product?.name;
    const description = item?.description || product?.subtitle;

    if (item?.itemType === 'product') {
        const { price, originalPrice, discountLabel } = getProductPricing(product || {});
        return (
            <div className={`${getAdminPreviewProductCardClass(mediaDisplay)} rounded-2xl bg-white p-2 shadow-sm`}>
                <div className="relative aspect-square overflow-hidden rounded-xl border border-gray-100 bg-[#f8f8f8]">
                    {image ? <img src={image} alt={title || ''} className="h-full w-full object-contain p-2" /> : <div className="h-full w-full bg-gray-100" />}
                </div>
                <div className="px-1 pt-3">
                    {title && <div className="line-clamp-1 text-sm font-bold text-gray-900 md:text-base">{title}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {(originalPrice && price && originalPrice > price) ? <span className="text-xs text-gray-500 line-through">Rs.{Number(originalPrice).toLocaleString()}</span> : null}
                        {price ? <span className="text-base font-bold text-gray-900 md:text-lg">Rs.{Number(price).toLocaleString()}</span> : null}
                        {discountLabel ? <span className="text-xs font-bold uppercase text-green-700">{discountLabel}</span> : null}
                    </div>
                    {description ? <div className="mt-1 line-clamp-1 text-xs font-semibold text-primary-600">{description}</div> : null}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`${mediaDisplay === 'single' ? 'w-full min-w-0' : mediaDisplay === 'grid' ? 'min-w-0' : 'w-[220px] shrink-0'} rounded-xl bg-white p-2 shadow-sm`}
            style={getAdminPreviewImageCardStyle(section, mediaDisplay)}
        >
            <div className="overflow-hidden rounded-xl bg-gray-100">
                {image ? <img src={image} alt="" className="w-full h-auto object-contain" /> : <div className="w-full min-h-[120px] bg-gray-100" />}
            </div>
            {(title || description) && <div className="pt-2">{title && <div className="text-sm font-semibold text-gray-900">{title}</div>}{description && <div className="mt-1 text-xs text-gray-500">{description}</div>}</div>}
        </div>
    );
};

const CarouselAdminPreview = ({ previewItems, section, getProduct }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [animating, setAnimating] = useState(false);
    const isPausedRef = useRef(false);
    const total = previewItems.length;

    const goTo = useCallback((index) => {
        if (animating) return;
        setAnimating(true);
        setActiveIndex(index);
        setTimeout(() => setAnimating(false), 420);
    }, [animating]);

    useEffect(() => {
        if (total <= 1) return;
        const tick = () => {
            if (!isPausedRef.current) setActiveIndex((prev) => (prev + 1) % total);
        };
        const id = window.setInterval(tick, 3000);
        return () => window.clearInterval(id);
    }, [total]);

    if (total === 0) return <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">No items to preview</div>;

    const item = previewItems[Math.min(activeIndex, total - 1)];

    return (
        <div
            className="relative w-full overflow-hidden rounded-2xl select-none"
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
        >
            <div style={{ opacity: animating ? 0.85 : 1, transition: 'opacity 0.38s ease' }}>
                <div className="flex justify-center">
                    <AdminPreviewItemCard item={item} mediaDisplay="single" getProduct={getProduct} section={section} />
                </div>
            </div>
            {total > 1 && (
                <>
                    <button type="button" onClick={() => goTo((activeIndex - 1 + total) % total)}
                        className="absolute left-2 top-[100px] -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <button type="button" onClick={() => goTo((activeIndex + 1) % total)}
                        className="absolute right-2 top-[100px] -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                </>
            )}
            {total > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {previewItems.map((_, i) => (
                        <button key={i} type="button" onClick={() => goTo(i)}
                            className="rounded-full transition-all"
                            style={{
                                width: i === activeIndex ? '18px' : '6px',
                                height: '6px',
                                backgroundColor: i === activeIndex ? '#ffffff' : 'rgba(255,255,255,0.5)',
                                transition: 'all 0.3s ease'
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};


const SectionPreviewCard = ({
    hasSelectedSection,
    section,
    selectedBackgroundType,
    isDefaultSubcategoriesSection,
    previewSubCategories,
    previewItems,
    getProduct
}) => {
    if (!hasSelectedSection) {
        return (
            <div className="w-full min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div><h3 className="text-base font-bold text-gray-900">Front-end Preview</h3><p className="mt-1 text-sm text-gray-500">This mirrors how the subcategory landing page will consume the saved config.</p></div>
                </div>
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm font-medium text-gray-600">
                    Select a section to preview.
                </div>
            </div>
        );
    }

    const previewDesktopPhotosPerRow = normalizeDesktopImageItemsPerRow(section?.desktopImageItemsPerRow);
    const shouldUseCustomImageGridPreview = section.sectionKind === 'image'
        && section.mediaDisplay === 'grid'
        && previewDesktopPhotosPerRow;
    const gridPreviewStyle = shouldUseCustomImageGridPreview
        ? {
            display: 'inline-grid',
            gridTemplateColumns: `repeat(${previewDesktopPhotosPerRow}, max-content)`,
            justifyContent: 'start',
            maxWidth: '100%'
        }
        : undefined;

    return (
        <div
            className="w-full min-w-0 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            style={{ contain: 'layout inline-size paint', isolation: 'isolate' }}
        >
            <div className="mb-4 flex items-center justify-between">
                <div><h3 className="text-base font-bold text-gray-900">Front-end Preview</h3><p className="mt-1 text-sm text-gray-500">This mirrors how the subcategory landing page will consume the saved config.</p></div>
                {section.showArrow && <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white"><MdArrowForward size={18} /></div>}
            </div>
            <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl">
                <div
                    className="w-full min-w-0 max-w-full rounded-2xl p-4"
                    style={{
                        backgroundColor: selectedBackgroundType === 'color' ? (section.backgroundColor || '#ffffff') : '#ffffff',
                        backgroundImage: selectedBackgroundType === 'image' && section.backgroundImage ? `url(${section.backgroundImage})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    {!isDefaultSubcategoriesSection && (section.title || section.description) && <div className="mb-4">{section.title && <h4 className="text-xl font-bold text-gray-900">{section.title}</h4>}{section.description && <p className="mt-1 text-sm text-gray-600">{section.description}</p>}</div>}
                    {isDefaultSubcategoriesSection ? (
                        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                            {previewSubCategories.length > 0 ? previewSubCategories.map((item) => (
                                <div key={item.id || item._id || item.name} className="rounded-lg bg-white p-2 shadow-sm">
                                    <div className="overflow-hidden rounded-lg bg-gray-100">
                                        {item.image ? <img src={item.image} alt={item.name} className="h-28 w-full object-cover" /> : <div className="h-28 w-full bg-gray-100" />}
                                    </div>
                                    <div className="pt-1.5">
                                        <div className="text-[13px] font-semibold leading-tight text-gray-900">{item.name}</div>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
                                    No brands found for this subcategory.
                                </div>
                            )}
                        </div>
                    ) : (section.mediaDisplay === 'carousel') ? (
                        <CarouselAdminPreview
                            previewItems={previewItems}
                            section={section}
                            getProduct={getProduct}
                        />
                    ) : (section.mediaDisplay === 'scroll') ? (
                        <div
                            className="w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden pb-3"
                            style={{ scrollbarGutter: 'stable both-edges' }}
                        >
                            <div className="flex min-w-max items-stretch gap-4 pr-2">
                                {previewItems.map((item) => {
                                    return <AdminPreviewItemCard key={item.id} item={item} mediaDisplay="scroll" getProduct={getProduct} section={section} />;
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full min-w-0 overflow-hidden">
                            <div
                                className={`${section.mediaDisplay === 'grid' ? 'grid grid-cols-2 gap-3 md:grid-cols-4' : 'block min-w-0'}`}
                                style={gridPreviewStyle}
                            >
                                {previewItems.map((item) => {
                                    return <AdminPreviewItemCard key={item.id} item={item} mediaDisplay={section.mediaDisplay} getProduct={getProduct} section={section} />;
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SubCategoryPageBuilder;
