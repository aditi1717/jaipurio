import legacyCategoryPageData from '../modules/user/data/categoryPageData';
import API from '../services/api';

export const CATEGORY_PAGE_BUILDER_STORAGE_KEY = 'subcategory-page-builder-catalog-v1';
const LEGACY_CATEGORY_PAGE_BUILDER_STORAGE_KEY = 'subcategory-page-builder-dummy-catalog-v1';
const CATEGORY_PAGE_BUILDER_IDB_NAME = 'jaipurio-subcategory-page-builder';
const CATEGORY_PAGE_BUILDER_IDB_STORE = 'catalog';
const CATEGORY_PAGE_BUILDER_IDB_KEY = 'catalog-v2';
const INDEXED_DB_POINTER = '__indexed_db__';
const SUBCATEGORY_PAGE_BUILDER_SERVER_FIELD = 'subCategoryPageCatalog';
const MAX_SYNC_LOCAL_STORAGE_BYTES = 120000;

const normalizeText = (value) => String(value || '').trim();
const normalizeKey = (value) => normalizeText(value).toLowerCase();

const makeLocalId = (prefix, seed) => {
    const cleanSeed = normalizeKey(seed).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `${prefix}-${cleanSeed || 'item'}`;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeDesktopImageItemsPerRow = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '';
    const rounded = Math.round(parsed);
    if (rounded < 1) return '';
    return Math.min(6, rounded);
};

const sanitizeSectionForWidthDrivenImages = (section = {}) => {
    if (!section || typeof section !== 'object') return section;
    const { imageHeight, ...rest } = section;
    return {
        ...rest,
        desktopImageItemsPerRow: normalizeDesktopImageItemsPerRow(rest.desktopImageItemsPerRow),
        items: toArray(rest.items)
    };
};

const sanitizeCategoryPageCatalog = (catalog = []) => {
    return toArray(catalog).map((entry) => ({
        ...entry,
        pageSections: toArray(entry?.pageSections).map((section) => sanitizeSectionForWidthDrivenImages(section))
    }));
};

const getCategoryId = (category) => String(category?.id || category?._id || normalizeKey(category?.name) || '');
const getCategoryDbId = (category) => String(category?._id || category?.dbId || category?.id || '');

const getCategoryChildren = (category) => {
    const directChildren = toArray(category?.children);
    if (directChildren.length > 0) return directChildren;
    return toArray(category?.subCategories);
};

const getSubCategoryImage = (subCategory) => normalizeText(
    subCategory?.image ||
    subCategory?.imageUrl ||
    subCategory?.thumbnail ||
    subCategory?.icon
);

const normalizeSubCategory = (subCategory, fallback = {}) => ({
    id: String(subCategory?.id || subCategory?._id || fallback?.id || makeLocalId('sub', subCategory?.name || fallback?.name)),
    name: normalizeText(subCategory?.name || fallback?.name),
    image: getSubCategoryImage(subCategory) || normalizeText(fallback?.image)
});

const buildCategoryStrip = (subCategories = [], existingStrip = {}) => {
    const existingItems = new Map(
        toArray(existingStrip?.items).map((item, index) => [
            String(item?.subCategoryId || ''),
            {
                id: String(item?.id || makeLocalId('strip', `${item?.subCategoryId || index}`)),
                subCategoryId: String(item?.subCategoryId || ''),
                isActive: item?.isActive !== false,
                order: Number(item?.order) || index + 1
            }
        ])
    );

    const items = subCategories.map((subCategory, index) => {
        const existing = existingItems.get(String(subCategory.id));
        return existing || {
            id: makeLocalId('strip', subCategory.name || subCategory.id),
            subCategoryId: String(subCategory.id),
            isActive: true,
            order: index + 1
        };
    });

    return {
        isActive: existingStrip?.isActive !== false,
        items: items
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((item, index) => ({ ...item, order: index + 1 }))
    };
};

const buildLegacyCatalog = () => {
    return Object.entries(legacyCategoryPageData || {}).map(([key, entry]) => {
        const displayName = normalizeText(entry?.categoryName) || key.charAt(0).toUpperCase() + key.slice(1);
        const legacyQuickLinks = toArray(entry?.quickLinks).map((item) => ({
            id: String(item?.id || makeLocalId('sub', item?.targetName || item?.name)),
            name: normalizeText(item?.targetName || item?.name),
            image: normalizeText(item?.image)
        })).filter((item) => item.name);

        const heroSection = toArray(entry?.heroSlides).length > 0 ? {
            id: makeLocalId('section', `${displayName}-hero`),
            sectionKind: 'image',
            isActive: true,
            order: 1,
            title: '',
            description: '',
            sectionLink: '',
            showArrow: false,
            backgroundType: 'color',
            backgroundColor: '#ffffff',
            backgroundImage: '',
            mediaDisplay: 'carousel',
            items: toArray(entry.heroSlides).map((slide, index) => ({
                id: makeLocalId('item', `${displayName}-hero-${index + 1}`),
                itemType: 'image',
                image: normalizeText(slide?.image),
                title: '',
                description: '',
                link: normalizeText(slide?.redirectLink)
            }))
        } : null;

        const scrollSection = toArray(entry?.scrollSection?.images).length > 0 ? {
            id: makeLocalId('section', `${displayName}-scroll`),
            sectionKind: 'image',
            isActive: true,
            order: heroSection ? 2 : 1,
            title: normalizeText(entry?.scrollSection?.title),
            description: '',
            sectionLink: '',
            showArrow: false,
            backgroundType: 'color',
            backgroundColor: '#ffffff',
            backgroundImage: '',
            mediaDisplay: 'scroll',
            items: toArray(entry.scrollSection.images).map((item, index) => ({
                id: makeLocalId('item', `${displayName}-scroll-${index + 1}`),
                itemType: 'image',
                image: normalizeText(item?.image),
                title: '',
                description: '',
                link: normalizeText(item?.redirectLink)
            }))
        } : null;

        return {
            id: makeLocalId('category', displayName),
            dbId: '',
            name: displayName,
            subCategories: legacyQuickLinks,
            products: [],
            categoryStrip: buildCategoryStrip(legacyQuickLinks),
            pageSections: [heroSection, scrollSection].filter(Boolean)
        };
    });
};

const legacyCatalog = buildLegacyCatalog();
const subCategoryConfigRequestStore = new Map();
const subCategoryLayoutRequestStore = new Map();
const subCategorySectionRequestStore = new Map();

const isNonEmptyCatalog = (catalog) => Array.isArray(catalog) && catalog.length > 0;

const setIndexedDbPointer = () => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(
            CATEGORY_PAGE_BUILDER_STORAGE_KEY,
            JSON.stringify({
                storage: INDEXED_DB_POINTER,
                updatedAt: Date.now()
            })
        );
    } catch {
        // Ignore storage pointer failures.
    }
};

const readStoredLocalCatalog = ({ allowLargePayload = false } = {}) => {
    if (typeof window === 'undefined') return null;

    const stored = window.localStorage.getItem(CATEGORY_PAGE_BUILDER_STORAGE_KEY);
    const legacyStored = window.localStorage.getItem(LEGACY_CATEGORY_PAGE_BUILDER_STORAGE_KEY);
    const source = stored || legacyStored;
    if (!source) return null;

    if (!allowLargePayload && source.length > MAX_SYNC_LOCAL_STORAGE_BYTES) {
        return null;
    }

    const parsed = JSON.parse(source);
    if (parsed?.storage === INDEXED_DB_POINTER) {
        return { storage: INDEXED_DB_POINTER };
    }

    return isNonEmptyCatalog(parsed) ? sanitizeCategoryPageCatalog(parsed) : null;
};

export const readCategoryPageCatalog = () => {
    if (typeof window === 'undefined') return legacyCatalog;

    try {
        const localCatalog = readStoredLocalCatalog();
        return isNonEmptyCatalog(localCatalog) ? localCatalog : legacyCatalog;
    } catch {
        return legacyCatalog;
    }
};

const openCategoryPageBuilderDb = () => new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
    }

    const request = window.indexedDB.open(CATEGORY_PAGE_BUILDER_IDB_NAME, 1);

    request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CATEGORY_PAGE_BUILDER_IDB_STORE)) {
            db.createObjectStore(CATEGORY_PAGE_BUILDER_IDB_STORE);
        }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
});

const readCatalogFromIndexedDb = async () => {
    const db = await openCategoryPageBuilderDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CATEGORY_PAGE_BUILDER_IDB_STORE, 'readonly');
        const store = transaction.objectStore(CATEGORY_PAGE_BUILDER_IDB_STORE);
        const request = store.get(CATEGORY_PAGE_BUILDER_IDB_KEY);

        request.onsuccess = () => {
            const result = request.result;
            resolve(Array.isArray(result) && result.length > 0 ? result : legacyCatalog);
        };
        request.onerror = () => reject(request.error || new Error('Failed to read IndexedDB catalog'));
        transaction.oncomplete = () => db.close();
    });
};

const writeCatalogToIndexedDb = async (catalog) => {
    const db = await openCategoryPageBuilderDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CATEGORY_PAGE_BUILDER_IDB_STORE, 'readwrite');
        const store = transaction.objectStore(CATEGORY_PAGE_BUILDER_IDB_STORE);
        store.put(catalog, CATEGORY_PAGE_BUILDER_IDB_KEY);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };
        transaction.onerror = () => reject(transaction.error || new Error('Failed to write IndexedDB catalog'));
    });
};

export const readCategoryPageCatalogAsync = async () => {
    // The server is the source of truth: writeCategoryPageCatalog() always PUTs
    // there, so IndexedDB/localStorage are only a per-browser cache. Reading the
    // cache first made every device show its own divergent catalog and never
    // pick up another device's saved changes.
    try {
        const { data } = await API.get('/settings');
        const serverCatalog = sanitizeCategoryPageCatalog(data?.[SUBCATEGORY_PAGE_BUILDER_SERVER_FIELD]);

        if (isNonEmptyCatalog(serverCatalog)) {
            if (typeof window !== 'undefined') {
                try {
                    await writeCatalogToIndexedDb(serverCatalog);
                    setIndexedDbPointer();
                } catch {
                    try {
                        window.localStorage.setItem(CATEGORY_PAGE_BUILDER_STORAGE_KEY, JSON.stringify(serverCatalog));
                    } catch {
                        // Ignore local mirror issues.
                    }
                }
            }
            return serverCatalog;
        }
        // Server reachable but empty: fall through to the cache rather than
        // blanking a browser whose earlier save may not have reached it.
    } catch {
        // Offline or request failed — use whatever this browser cached.
    }

    try {
        const localCatalog = readStoredLocalCatalog();
        if (isNonEmptyCatalog(localCatalog)) {
            return localCatalog;
        }
    } catch {
        // Continue to IndexedDB fallback.
    }

    try {
        const indexedDbCatalog = sanitizeCategoryPageCatalog(await readCatalogFromIndexedDb());
        if (isNonEmptyCatalog(indexedDbCatalog)) {
            setIndexedDbPointer();
            return indexedDbCatalog;
        }
    } catch {
        // Continue to final local fallback.
    }

    try {
        const largeLocalCatalog = readStoredLocalCatalog({ allowLargePayload: true });
        if (isNonEmptyCatalog(largeLocalCatalog)) {
            return largeLocalCatalog;
        }
    } catch {
        // Ignore final local fallback failures.
    }

    return legacyCatalog;
};

export const readSubCategoryPageConfigEntryAsync = async (categoryName, subCategoryName) => {
    const normalizedCategoryName = normalizeText(categoryName);
    const normalizedSubCategoryName = normalizeText(subCategoryName);
    if (!normalizedCategoryName || !normalizedSubCategoryName) return null;

    const cacheKey = `${normalizeKey(normalizedCategoryName)}::${normalizeKey(normalizedSubCategoryName)}`;
    if (subCategoryConfigRequestStore.has(cacheKey)) {
        return subCategoryConfigRequestStore.get(cacheKey);
    }

    const request = (async () => {
        try {
            const { data } = await API.get(
                `/settings/subcategory-page-config/${encodeURIComponent(normalizedCategoryName)}/${encodeURIComponent(normalizedSubCategoryName)}`
            );
            return data?.config || null;
        } catch {
            try {
                const localCatalog = await readCategoryPageCatalogAsync();
                const targetName = `${normalizeKey(normalizedCategoryName)} / ${normalizeKey(normalizedSubCategoryName)}`;
                return (Array.isArray(localCatalog) ? localCatalog : []).find(
                    (entry) => normalizeKey(entry?.name) === targetName
                ) || null;
            } catch {
                return null;
            }
        } finally {
            subCategoryConfigRequestStore.delete(cacheKey);
        }
    })();

    subCategoryConfigRequestStore.set(cacheKey, request);
    return request;
};

export const readSubCategoryPageLayoutEntryAsync = async (categoryName, subCategoryName) => {
    const normalizedCategoryName = normalizeText(categoryName);
    const normalizedSubCategoryName = normalizeText(subCategoryName);
    if (!normalizedCategoryName || !normalizedSubCategoryName) return null;

    const cacheKey = `${normalizeKey(normalizedCategoryName)}::${normalizeKey(normalizedSubCategoryName)}`;
    if (subCategoryLayoutRequestStore.has(cacheKey)) {
        return subCategoryLayoutRequestStore.get(cacheKey);
    }

    const request = (async () => {
        try {
            const { data } = await API.get(
                `/settings/subcategory-page-layout/${encodeURIComponent(normalizedCategoryName)}/${encodeURIComponent(normalizedSubCategoryName)}`
            );
            return data?.config || null;
        } catch {
            try {
                const localCatalog = await readCategoryPageCatalogAsync();
                const targetName = `${normalizeKey(normalizedCategoryName)} / ${normalizeKey(normalizedSubCategoryName)}`;
                const localEntry = (Array.isArray(localCatalog) ? localCatalog : []).find(
                    (entry) => normalizeKey(entry?.name) === targetName
                ) || null;
                if (!localEntry) return null;
                return {
                    ...localEntry,
                    products: [],
                    pageSections: toArray(localEntry.pageSections).map((section) => ({
                        ...section,
                        items: [],
                        itemCount: Array.isArray(section?.items) ? section.items.length : 0
                    }))
                };
            } catch {
                return null;
            }
        } finally {
            subCategoryLayoutRequestStore.delete(cacheKey);
        }
    })();

    subCategoryLayoutRequestStore.set(cacheKey, request);
    return request;
};

export const readSubCategoryPageSectionAsync = async (categoryName, subCategoryName, sectionId) => {
    const normalizedCategoryName = normalizeText(categoryName);
    const normalizedSubCategoryName = normalizeText(subCategoryName);
    const normalizedSectionId = String(sectionId || '').trim();
    if (!normalizedCategoryName || !normalizedSubCategoryName || !normalizedSectionId) return null;

    const cacheKey = `${normalizeKey(normalizedCategoryName)}::${normalizeKey(normalizedSubCategoryName)}::${normalizedSectionId}`;
    if (subCategorySectionRequestStore.has(cacheKey)) {
        return subCategorySectionRequestStore.get(cacheKey);
    }

    const request = (async () => {
        try {
            const { data } = await API.get(
                `/settings/subcategory-page-section/${encodeURIComponent(normalizedCategoryName)}/${encodeURIComponent(normalizedSubCategoryName)}/${encodeURIComponent(normalizedSectionId)}`
            );
            return {
                section: data?.section || null,
                products: Array.isArray(data?.products) ? data.products : []
            };
        } catch {
            try {
                const localCatalog = await readCategoryPageCatalogAsync();
                const targetName = `${normalizeKey(normalizedCategoryName)} / ${normalizeKey(normalizedSubCategoryName)}`;
                const localEntry = (Array.isArray(localCatalog) ? localCatalog : []).find(
                    (entry) => normalizeKey(entry?.name) === targetName
                ) || null;
                const localSection = toArray(localEntry?.pageSections).find(
                    (section) => String(section?.id || '').trim() === normalizedSectionId
                ) || null;
                return {
                    section: localSection,
                    products: Array.isArray(localEntry?.products) ? localEntry.products : []
                };
            } catch {
                return { section: null, products: [] };
            }
        } finally {
            subCategorySectionRequestStore.delete(cacheKey);
        }
    })();

    subCategorySectionRequestStore.set(cacheKey, request);
    return request;
};

export const writeCategoryPageCatalog = async (catalog) => {
    if (typeof window === 'undefined') return;

    const sanitizedCatalog = sanitizeCategoryPageCatalog(catalog);

    try {
        await API.put('/settings', {
            [SUBCATEGORY_PAGE_BUILDER_SERVER_FIELD]: sanitizedCatalog
        });
    } catch {
        // Continue with local persistence fallback.
    }

    try {
        await writeCatalogToIndexedDb(sanitizedCatalog);
        setIndexedDbPointer();
        window.dispatchEvent(new CustomEvent('subcategory-page-builder-updated'));
        return;
    } catch (error) {
        try {
            window.localStorage.setItem(CATEGORY_PAGE_BUILDER_STORAGE_KEY, JSON.stringify(sanitizedCatalog));
        } catch {
            // Ignore local-only fallback failures.
        }
        window.dispatchEvent(new CustomEvent('subcategory-page-builder-updated'));
        return;
    }
};

export const mergeCategoryPageCatalogWithCategories = (catalog, categories = []) => {
    const existingEntries = new Map(
        toArray(catalog).map((entry) => [normalizeKey(entry?.name), entry])
    );

    if (!Array.isArray(categories) || categories.length === 0) {
        return toArray(catalog);
    }

    const merged = categories.map((category) => {
        const categoryName = normalizeText(category?.name);
        const existing = existingEntries.get(normalizeKey(categoryName)) || {};
        const existingSubCategoryMap = new Map(
            toArray(existing?.subCategories).map((item) => [normalizeKey(item?.name), item])
        );
        const incomingSubCategories = getCategoryChildren(category)
            .map((item) => normalizeSubCategory(item, existingSubCategoryMap.get(normalizeKey(item?.name))))
            .filter((item) => item.name);
        const subCategories = incomingSubCategories.length > 0
            ? incomingSubCategories
            : toArray(existing?.subCategories);

        return {
            ...existing,
            id: getCategoryId(category) || String(existing?.id || makeLocalId('category', categoryName)),
            dbId: getCategoryDbId(category) || String(existing?.dbId || ''),
            name: categoryName,
            subCategories,
            products: toArray(existing?.products),
            categoryStrip: buildCategoryStrip(subCategories, existing?.categoryStrip),
            pageSections: toArray(existing?.pageSections)
                .map((section, index) => ({ ...section, order: Number(section?.order) || index + 1 }))
                .sort((a, b) => (a.order || 0) - (b.order || 0))
        };
    });

    const knownKeys = new Set(categories.map((category) => normalizeKey(category?.name)));
    const extras = toArray(catalog).filter((entry) => !knownKeys.has(normalizeKey(entry?.name)));

    return [...merged, ...extras];
};

export const getCategoryPageConfig = (categoryName, categories = []) => {
    const mergedCatalog = mergeCategoryPageCatalogWithCategories(readCategoryPageCatalog(), categories);
    return mergedCatalog.find((entry) => normalizeKey(entry?.name) === normalizeKey(categoryName)) || null;
};

export const getCategoryStripItems = (categoryConfig) => {
    if (!categoryConfig?.categoryStrip?.isActive) return [];

    const subCategoryMap = new Map(
        toArray(categoryConfig?.subCategories).map((item) => [String(item?.id), item])
    );

    return toArray(categoryConfig?.categoryStrip?.items)
        .filter((item) => item?.isActive !== false)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item) => subCategoryMap.get(String(item?.subCategoryId)))
        .filter(Boolean)
        .map((subCategory) => ({
            id: subCategory.id,
            name: subCategory.name,
            image: subCategory.image,
            targetName: subCategory.name
        }));
};

export const getOrderedCategorySubCategories = (categoryConfig, detailedSubCategories = []) => {
    const baseItems = toArray(categoryConfig?.subCategories);
    if (baseItems.length === 0) {
        if (!Array.isArray(detailedSubCategories) || detailedSubCategories.length === 0) return [];
        return detailedSubCategories
            .map((item) => normalizeSubCategory(item))
            .filter((item) => item.name);
    }
    if (!Array.isArray(detailedSubCategories) || detailedSubCategories.length === 0) return baseItems;

    const detailedById = new Map(
        detailedSubCategories.map((item) => [String(item?.id || item?._id || ''), item])
    );
    const detailedByName = new Map(
        detailedSubCategories.map((item) => [normalizeKey(item?.name), item])
    );

    const ordered = baseItems.map((item) => {
        const detailed = detailedById.get(String(item?.id || ''))
            || detailedByName.get(normalizeKey(item?.name));

        return detailed ? normalizeSubCategory(detailed, item) : item;
    });

    const usedNames = new Set(ordered.map((item) => normalizeKey(item?.name)));
    const extras = detailedSubCategories
        .filter((item) => !usedNames.has(normalizeKey(item?.name)))
        .map((item) => normalizeSubCategory(item));

    return [...ordered, ...extras];
};
