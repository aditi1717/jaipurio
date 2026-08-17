import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdArrowBack, MdKeyboardArrowDown, MdKeyboardArrowUp, MdStar } from 'react-icons/md';
import API from '../../../services/api';
import { useCategories } from '../../../hooks/useData';
import { resolveCategoryPath } from '../../../utils/categoryUtils';
import SubCategoryList from '../components/category/SubCategoryList';
import CategoryLandingSections from '../components/category/CategoryLandingSections';
import SubCategoryLandingSections from '../components/category/SubCategoryLandingSections';
import ProductCard from '../components/product/ProductCard';
import BottomNav from '../components/layout/BottomNav';

const SORT_OPTIONS = [
    { id: 'popularity', label: 'Popularity' },
    { id: 'price-low', label: 'Price -- Low to High' },
    { id: 'price-high', label: 'Price -- High to Low' },
    { id: 'rating', label: 'Customer Rating' }
];
const RATING_OPTIONS = [4, 3, 2];
const DISCOUNT_OPTIONS = [50, 40, 30, 20, 10];

const CategoryPageSkeleton = () => (
    <div className="min-h-screen animate-pulse bg-white pb-36 md:pb-10">
        <div className="border-b border-gray-200 bg-white shadow-sm">
            <div className="mx-auto max-w-[1440px] px-2 py-3 md:px-4 lg:px-5">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gray-200" />
                    <div className="h-7 w-44 rounded bg-gray-200" />
                </div>
            </div>
        </div>
        <div className="mx-auto max-w-[1440px] px-2 pb-4 pt-2 md:px-4 lg:px-5">
            <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 md:gap-5 md:p-6 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                        <div className="aspect-square rounded-xl bg-gray-200" />
                        <div className="h-3 w-4/5 rounded bg-gray-200" />
                        <div className="h-3 w-2/3 rounded bg-gray-200" />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const FilterSection = ({ sectionKey, title, collapsedSections, toggleSection, badge, children }) => (
    <div className="px-4 py-4">
        <button type="button" onClick={() => toggleSection(sectionKey)} className="flex w-full items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2">
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-800">{title}</h4>
                {badge ? <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700">{badge}</span> : null}
            </div>
            {collapsedSections[sectionKey] ? <MdKeyboardArrowDown className="text-lg text-gray-500" /> : <MdKeyboardArrowUp className="text-lg text-gray-500" />}
        </button>
        {!collapsedSections[sectionKey] ? <div className="mt-4">{children}</div> : null}
    </div>
);

const FilterCheckRow = ({ checked, onChange, label }) => (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2 hover:border-gray-200 hover:bg-gray-50">
        <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 rounded accent-primary-600" />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
    </label>
);

const FilterRadioRow = ({ checked, onChange, label, name }) => (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2 hover:border-gray-200 hover:bg-gray-50">
        <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-primary-600" />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
    </label>
);

const getDistinctValues = (items = [], picker) => {
    const seen = new Set();
    const values = [];

    items.forEach((item) => {
        const rawValue = typeof picker === 'function' ? picker(item) : item?.[picker];
        const trimmedValue = String(rawValue || '').trim();
        if (!trimmedValue) return;

        const normalizedValue = trimmedValue.toLowerCase();
        if (seen.has(normalizedValue)) return;

        seen.add(normalizedValue);
        values.push(trimmedValue);
    });

    return values.sort((a, b) => a.localeCompare(b));
};

const CategoryPage = () => {
    const navigate = useNavigate();
    const { categoryName, '*': subPath } = useParams();
    const routeSegments = String(subPath || '').split('/').filter(Boolean);
    const routeDepth = routeSegments.length;
    const routeHasExplicitSubPath = routeSegments.length > 0;
    const { categories, loading: categoriesLoading } = useCategories({ lite: true });
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [categoryData, setCategoryData] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [categoryProducts, setCategoryProducts] = useState([]);
    const [sortedProducts, setSortedProducts] = useState([]);
    const [showSortModal, setShowSortModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [sortBy, setSortBy] = useState('popularity');
    const [filterRange, setFilterRange] = useState([0, 1000000]);
    const [priceRange, setPriceRange] = useState({ min: 0, max: 1000000 });
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [selectedRam, setSelectedRam] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedDiscount, setSelectedDiscount] = useState(null);
    const [selectedRating, setSelectedRating] = useState(null);
    const [brandSearch, setBrandSearch] = useState('');
    const [showAllBrands, setShowAllBrands] = useState(false);
    const [showAllRam, setShowAllRam] = useState(false);
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState({});
    const [fetchError, setFetchError] = useState('');
    const [subCategoryHasBrands, setSubCategoryHasBrands] = useState(null);

    const normalizeText = (value) => String(value || '').trim().toLowerCase();
    const parseAmount = (value, fallback = 0) => {
        const parsed = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
        return Number.isFinite(parsed) ? parsed : fallback;
    };
    const getEffectivePricing = (product) => {
        const skus = Array.isArray(product?.skus) ? product.skus : [];
        const firstSku = skus.length > 0 ? skus[0] : null;
        const price = parseAmount(firstSku?.price ?? product?.price ?? 0, 0);
        const rawOriginalPrice = parseAmount(firstSku?.originalPrice ?? product?.originalPrice ?? price, price);
        const originalPrice = Math.max(rawOriginalPrice, price);
        const discountFromText = Number.parseInt(String(product?.discount || '').replace(/\D/g, ''), 10) || 0;
        const discountPercent = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : discountFromText;
        return { price, originalPrice, discountPercent };
    };

    useEffect(() => {
        let active = true;

        const decideSubCategoryLandingMode = async () => {
            if (routeDepth !== 1) {
                setSubCategoryHasBrands(null);
                return;
            }

            const currentCategoryName = decodeURIComponent(categoryName || '').trim().toLowerCase();
            const currentSubCategoryName = decodeURIComponent(routeSegments[0] || '').trim().toLowerCase();

            if (!currentCategoryName || !currentSubCategoryName) {
                setSubCategoryHasBrands(false);
                return;
            }

            try {
                const results = await Promise.allSettled([
                    API.get('/subcategories'),
                    API.get('/brands'),
                    API.get(`/products?category=${encodeURIComponent(decodeURIComponent(categoryName || ''))}&subcategory=${encodeURIComponent(decodeURIComponent(routeSegments[0] || ''))}&lite=true`)
                ]);

                if (!active) return;

                const subcategories = results[0].status === 'fulfilled' && Array.isArray(results[0].value?.data) ? results[0].value.data : [];
                const brands = results[1].status === 'fulfilled' && Array.isArray(results[1].value?.data) ? results[1].value.data : [];
                const productRaw = results[2].status === 'fulfilled' ? results[2].value?.data : null;
                const products = Array.isArray(productRaw) ? productRaw : (Array.isArray(productRaw?.products) ? productRaw.products : []);

                const selectedSubCategory = subcategories.find((sub) => (
                    String(sub?.name || '').trim().toLowerCase() === currentSubCategoryName &&
                    String(sub?.category?.name || '').trim().toLowerCase() === currentCategoryName
                ));

                const hasProductLevelBrands = products.some((product) => String(product?.subcategoryBrand || '').trim());

                let hasBrands = hasProductLevelBrands;
                if (selectedSubCategory) {
                    const selectedSubCategoryId = String(selectedSubCategory?._id || selectedSubCategory?.id || '').trim();
                    hasBrands = hasBrands || brands.some((brand) => (
                        String(brand?.subcategory?._id || brand?.subcategory || '').trim() === selectedSubCategoryId &&
                        brand?.isActive !== false
                    ));
                }

                setSubCategoryHasBrands(hasBrands);
            } catch {
                if (!active) return;
                setSubCategoryHasBrands(false);
            }
        };

        decideSubCategoryLandingMode();
        return () => { active = false; };
    }, [routeDepth, categoryName, subPath, routeSegments]);

    useEffect(() => {
        let active = true;
        const fetchCategoryProducts = async () => {
            const shouldUseSubcategoryLanding = routeDepth === 1 && subCategoryHasBrands === true;
            if (routeDepth === 0 || shouldUseSubcategoryLanding || (routeDepth === 1 && subCategoryHasBrands === null)) {
                setProducts([]);
                setProductsLoading(routeDepth === 1 && subCategoryHasBrands === null);
                setFetchError('');
                return;
            }
            setProductsLoading(true);
            setFetchError('');
            try {
                const params = new URLSearchParams();
                if (categoryName) params.set('category', decodeURIComponent(categoryName));
                const leafSubCategory = routeSegments.length > 0 ? decodeURIComponent(routeSegments[routeSegments.length - 1]) : '';
                if (leafSubCategory) params.set('subcategory', leafSubCategory);
                params.set('lite', 'true');
                const { data } = await API.get(`/products?${params.toString()}`);
                if (!active) return;
                setProducts(Array.isArray(data) ? data : (data?.products || []));
            } catch (error) {
                if (!active) return;
                setProducts([]);
                setFetchError(error?.response?.data?.message || 'Failed to load products');
            } finally {
                if (active) setProductsLoading(false);
            }
        };
        fetchCategoryProducts();
        return () => { active = false; };
    }, [categoryName, subPath, routeDepth, subCategoryHasBrands]);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (productsLoading || categoriesLoading) return;
        const result = resolveCategoryPath(categories, products, categoryName, subPath);
        const explicitSubPath = String(subPath || '').split('/').filter(Boolean).length > 0;
        if (result && result.data) {
            setCategoryData(result.data);
            setBreadcrumbs(result.breadcrumbs || []);
            const routeProducts = explicitSubPath ? products : result.products;
            setCategoryProducts(routeProducts);
            setSortedProducts(routeProducts);
            if (routeProducts.length > 0) {
                const prices = routeProducts.map((product) => getEffectivePricing(product).price);
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                setPriceRange({ min, max });
                setFilterRange([min, max]);
            }
        } else {
            setCategoryData(null);
            setBreadcrumbs([]);
        }
    }, [categoryName, subPath, products, categories, productsLoading, categoriesLoading]);

    useEffect(() => {
        setSortBy('popularity');
        setSelectedBrands([]);
        setSelectedRam([]);
        setSelectedCategories([]);
        setSelectedDiscount(null);
        setSelectedRating(null);
        setBrandSearch('');
        setShowAllBrands(false);
        setShowAllRam(false);
        setShowAllCategories(false);
        setCollapsedSections({});
        setFilterRange([0, 1000000]);
        setPriceRange({ min: 0, max: 1000000 });
    }, [categoryName, subPath]);

    useEffect(() => {
        let updated = [...categoryProducts];
        updated = updated.filter((product) => {
            const { price } = getEffectivePricing(product);
            return price >= filterRange[0] && price <= filterRange[1];
        });
        if (sortBy === 'price-low') updated.sort((a, b) => getEffectivePricing(a).price - getEffectivePricing(b).price);
        else if (sortBy === 'price-high') updated.sort((a, b) => getEffectivePricing(b).price - getEffectivePricing(a).price);
        else if (sortBy === 'rating') updated.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        if (selectedCategories.length > 0) updated = updated.filter((product) => Array.isArray(product.tags) && product.tags.some((tag) => selectedCategories.some((selected) => normalizeText(selected) === normalizeText(tag))));
        if (selectedBrands.length > 0) updated = updated.filter((product) => product.brand && selectedBrands.some((brand) => normalizeText(brand) === normalizeText(product.brand)));
        if (selectedRam.length > 0) updated = updated.filter((product) => product.ram && selectedRam.some((ram) => normalizeText(ram) === normalizeText(product.ram)));
        if (selectedDiscount) updated = updated.filter((product) => getEffectivePricing(product).discountPercent >= selectedDiscount);
        if (selectedRating) updated = updated.filter((product) => Number(product.rating || 0) >= selectedRating);
        setSortedProducts(updated);
    }, [sortBy, filterRange, selectedBrands, selectedRam, selectedCategories, selectedDiscount, selectedRating, categoryProducts]);

    const availableBrands = useMemo(() => getDistinctValues(categoryProducts, (product) => product?.brand), [categoryProducts]);
    const fallbackBrandName = routeHasExplicitSubPath
        ? String(routeSegments[routeSegments.length - 1] || '').trim()
        : '';
    const effectiveAvailableBrands = useMemo(() => {
        if (availableBrands.length > 0) return availableBrands;
        if (fallbackBrandName && categoryProducts.length > 0) return [fallbackBrandName];
        return [];
    }, [availableBrands, fallbackBrandName, categoryProducts.length]);
    const availableRam = useMemo(() => getDistinctValues(categoryProducts, (product) => product?.ram), [categoryProducts]);
    const availableCategories = useMemo(
        () => getDistinctValues(
            categoryProducts.flatMap((product) => product?.tags || []),
            (tag) => {
                const trimmedTag = String(tag || '').trim();
                return normalizeText(trimmedTag) === normalizeText(categoryData?.name) ? '' : trimmedTag;
            }
        ),
        [categoryProducts, categoryData?.name]
    );
    const filteredBrands = effectiveAvailableBrands.filter((brand) => brand.toLowerCase().includes(brandSearch.toLowerCase()));
    const displayedBrands = showAllBrands ? filteredBrands : filteredBrands.slice(0, 6);
    const displayedRam = showAllRam ? availableRam : availableRam.slice(0, 6);
    const displayedCategories = showAllCategories ? availableCategories : availableCategories.slice(0, 6);
    const activeFilterCount = useMemo(() => selectedBrands.length + selectedRam.length + selectedCategories.length + (selectedDiscount ? 1 : 0) + (selectedRating ? 1 : 0) + ((filterRange[0] !== priceRange.min || filterRange[1] !== priceRange.max) ? 1 : 0), [selectedBrands, selectedRam, selectedCategories, selectedDiscount, selectedRating, filterRange, priceRange]);
    const activeFilterChips = useMemo(() => ([...(selectedRating ? [`${selectedRating}★ & above`] : []), ...(selectedDiscount ? [`${selectedDiscount}% off`] : []), ...selectedBrands.map((brand) => `Brand: ${brand}`), ...selectedRam.map((ram) => `RAM: ${ram}`), ...selectedCategories.map((category) => `Type: ${category}`), ...((filterRange[0] !== priceRange.min || filterRange[1] !== priceRange.max) ? [`₹${filterRange[0].toLocaleString()} - ₹${filterRange[1].toLocaleString()}`] : [])]), [selectedRating, selectedDiscount, selectedBrands, selectedRam, selectedCategories, filterRange, priceRange]);
    if (productsLoading || categoriesLoading) return <CategoryPageSkeleton />;
    if (fetchError) return <div className="p-10 text-center text-red-500">{fetchError}</div>;
    if (!categoryData) return <div className="p-10 text-center">Category not found</div>;

    const isCategoryLandingView = routeDepth === 0 && breadcrumbs.length === 1;
    const isSubCategoryLandingView = routeDepth === 1 && subCategoryHasBrands === true;
    const isProductListingView = routeDepth > 1 || (routeDepth === 1 && subCategoryHasBrands === false);
    const rootCategory = breadcrumbs[0] || categoryData;
    const gridSubCategories = [];
    const handleBackNavigation = () => {
        if (window.history.state?.idx > 0) return navigate(-1);
        navigate('/');
    };
    const handlePriceInputChange = (index, value) => {
        const parsedValue = parseInt(value, 10);
        const nextValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0;
        const nextRange = [...filterRange];
        nextRange[index] = nextValue;
        if (index === 0 && nextRange[0] > nextRange[1]) nextRange[1] = nextRange[0];
        if (index === 1 && nextRange[1] < nextRange[0]) nextRange[0] = nextRange[1];
        setFilterRange(nextRange);
    };
    const resetAllFilters = () => {
        setFilterRange([priceRange.min, priceRange.max]);
        setSelectedBrands([]);
        setSelectedRam([]);
        setSelectedCategories([]);
        setSelectedDiscount(null);
        setSelectedRating(null);
        setBrandSearch('');
    };
    const toggleBrand = (brand) => setSelectedBrands((prev) => prev.includes(brand) ? prev.filter((item) => item !== brand) : [...prev, brand]);
    const toggleRam = (ram) => setSelectedRam((prev) => prev.includes(ram) ? prev.filter((item) => item !== ram) : [...prev, ram]);
    const toggleCategory = (category) => setSelectedCategories((prev) => prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]);
    const toggleSection = (section) => setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));

    return (
        <div className="min-h-screen bg-white pb-36 md:pb-10">
            <div className="z-40 border-b border-gray-200 bg-white shadow-sm md:sticky md:top-[116px]">
                <div className="mx-auto max-w-[1440px] px-2 pb-3 pt-3 md:px-4 lg:px-5">
                    <div className="flex items-center gap-3">
                        <button onClick={handleBackNavigation} className="rounded-full bg-gray-50 p-2 transition-colors hover:bg-gray-100"><MdArrowBack className="text-xl text-gray-700" /></button>
                        <h1 className="text-base font-bold capitalize tracking-tight text-gray-900 md:text-2xl md:font-black">{categoryData.name}</h1>
                    </div>
                </div>
            </div>
            <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-[1440px] flex-col px-2 pb-4 pt-1 md:px-4 md:py-4 lg:px-5">
                <div className="relative flex h-full flex-col gap-4 lg:flex-row">
                    {isProductListingView && (
                        <aside className="sticky top-[128px] hidden h-fit w-[300px] shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:block xl:w-[320px]">
                            <div className="border-b border-gray-100 bg-white px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-900">Filters</h3>
                                        <p className="mt-1 text-xs font-medium text-gray-500">{sortedProducts.length} matching products</p>
                                    </div>
                                    <button onClick={resetAllFilters} className="text-[11px] font-black uppercase text-primary-600 hover:text-primary-700">Clear All</button>
                                </div>
                                {activeFilterChips.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{activeFilterChips.slice(0, 5).map((chip) => <span key={chip} className="rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-[10px] font-bold text-primary-700">{chip}</span>)}{activeFilterChips.length > 5 && <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-500">+{activeFilterChips.length - 5} more</span>}</div>}
                            </div>
                            <div className="divide-y divide-gray-100">
                                <FilterSection sectionKey="sort" title="Sort" badge={sortBy === 'popularity' ? 'Default' : sortBy.replace('-', ' ')} collapsedSections={collapsedSections} toggleSection={toggleSection}>
                                    <div className="space-y-2">{SORT_OPTIONS.map((option) => <FilterRadioRow key={option.id} name="desktop-sort" checked={sortBy === option.id} onChange={() => setSortBy(option.id)} label={option.label} />)}</div>
                                </FilterSection>
                                <FilterSection sectionKey="price" title="Price" badge={`₹${priceRange.min.toLocaleString()} - ₹${priceRange.max.toLocaleString()}`} collapsedSections={collapsedSections} toggleSection={toggleSection}>
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Min</span><div className="mt-1 flex items-center gap-1"><span className="text-sm font-black text-gray-900">₹</span><input type="number" value={filterRange[0]} min={priceRange.min} max={filterRange[1]} onChange={(e) => handlePriceInputChange(0, e.target.value)} className="w-full bg-transparent text-sm font-black text-gray-900 focus:outline-none" /></div></div>
                                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Max</span><div className="mt-1 flex items-center gap-1"><span className="text-sm font-black text-gray-900">₹</span><input type="number" value={filterRange[1]} min={filterRange[0]} max={priceRange.max} onChange={(e) => handlePriceInputChange(1, e.target.value)} className="w-full bg-transparent text-sm font-black text-gray-900 focus:outline-none" /></div></div>
                                        </div>
                                        <div className="space-y-2">
                                            <input type="range" min={priceRange.min} max={priceRange.max} value={filterRange[0]} onChange={(e) => handlePriceInputChange(0, e.target.value)} className="w-full accent-primary-600" />
                                            <input type="range" min={priceRange.min} max={priceRange.max} value={filterRange[1]} onChange={(e) => handlePriceInputChange(1, e.target.value)} className="w-full accent-primary-600" />
                                            <div className="flex items-center justify-between text-xs font-semibold text-gray-500"><span>₹{priceRange.min.toLocaleString()}</span><span>₹{priceRange.max.toLocaleString()}</span></div>
                                        </div>
                                    </div>
                                </FilterSection>
                                <FilterSection sectionKey="rating" title="Customer Ratings" badge={selectedRating ? `${selectedRating}★` : null} collapsedSections={collapsedSections} toggleSection={toggleSection}>
                                    <div className="space-y-2">{RATING_OPTIONS.map((rating) => <FilterRadioRow key={rating} name="desktop-rating" checked={selectedRating === rating} onChange={() => setSelectedRating(rating)} label={<span className="flex items-center gap-1"><span>{rating}</span><MdStar className="text-base text-green-600" /><span>& above</span></span>} />)}<button type="button" onClick={() => setSelectedRating(null)} className="px-3 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-primary-600">Clear Rating</button></div>
                                </FilterSection>
                                <FilterSection sectionKey="discount" title="Discount" badge={selectedDiscount ? `${selectedDiscount}%+` : null} collapsedSections={collapsedSections} toggleSection={toggleSection}>
                                    <div className="space-y-2">{DISCOUNT_OPTIONS.map((discount) => <FilterRadioRow key={discount} name="desktop-discount" checked={selectedDiscount === discount} onChange={() => setSelectedDiscount(discount)} label={`${discount}% or more`} />)}<button type="button" onClick={() => setSelectedDiscount(null)} className="px-3 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-primary-600">Clear Discount</button></div>
                                </FilterSection>
                                {effectiveAvailableBrands.length > 0 && <FilterSection sectionKey="brand" title="Brand" badge={selectedBrands.length > 0 ? selectedBrands.length : null} collapsedSections={collapsedSections} toggleSection={toggleSection}><div className="space-y-3"><input type="text" value={brandSearch} onChange={(e) => setBrandSearch(e.target.value)} placeholder="Search brand" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-primary-500" /><div className="space-y-1">{displayedBrands.map((brand) => <FilterCheckRow key={brand} checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} label={brand} />)}</div>{filteredBrands.length > 6 && <button type="button" onClick={() => setShowAllBrands((prev) => !prev)} className="px-3 text-xs font-bold uppercase tracking-wider text-primary-600 hover:text-primary-700">{showAllBrands ? 'Show Less' : `Show ${filteredBrands.length - 6} More`}</button>}</div></FilterSection>}
                                {availableRam.length > 0 && <FilterSection sectionKey="ram" title="RAM" badge={selectedRam.length > 0 ? selectedRam.length : null} collapsedSections={collapsedSections} toggleSection={toggleSection}><div className="space-y-1">{displayedRam.map((ram) => <FilterCheckRow key={ram} checked={selectedRam.includes(ram)} onChange={() => toggleRam(ram)} label={ram} />)}{availableRam.length > 6 && <button type="button" onClick={() => setShowAllRam((prev) => !prev)} className="px-3 text-xs font-bold uppercase tracking-wider text-primary-600 hover:text-primary-700">{showAllRam ? 'Show Less' : `Show ${availableRam.length - 6} More`}</button>}</div></FilterSection>}
                                {availableCategories.length > 0 && <FilterSection sectionKey="category" title="Category" badge={selectedCategories.length > 0 ? selectedCategories.length : null} collapsedSections={collapsedSections} toggleSection={toggleSection}><div className="space-y-1">{displayedCategories.map((category) => <FilterCheckRow key={category} checked={selectedCategories.includes(category)} onChange={() => toggleCategory(category)} label={category} />)}{availableCategories.length > 6 && <button type="button" onClick={() => setShowAllCategories((prev) => !prev)} className="px-3 text-xs font-bold uppercase tracking-wider text-primary-600 hover:text-primary-700">{showAllCategories ? 'Show Less' : `Show ${availableCategories.length - 6} More`}</button>}</div></FilterSection>}
                            </div>
                        </aside>
                    )}
                    <main className={`min-w-0 flex-1 ${isProductListingView ? 'md:pr-2' : ''}`}>
                        {isCategoryLandingView && <div className="relative"><CategoryLandingSections categoryName={rootCategory.name} /></div>}
                        {isCategoryLandingView && <div className="relative"><SubCategoryList subCategories={isCategoryLandingView ? gridSubCategories : []} categoryName={rootCategory.name} /></div>}
                        {isSubCategoryLandingView && (
                            <div className="relative">
                                <SubCategoryLandingSections
                                    categoryName={decodeURIComponent(categoryName || '')}
                                    subCategoryName={decodeURIComponent(routeSegments[0] || '')}
                                />
                            </div>
                        )}
                        {isProductListingView && (
                            <div className="min-h-[600px] border border-gray-100 bg-white p-3 md:rounded-lg md:p-6 md:shadow-sm">
                                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-gray-900">Product List<div className="h-1.5 w-1.5 rounded-full bg-primary-600" /></h2>
                                        <p className="mt-1 text-xs font-medium text-gray-500">Showing results for {categoryData.name}{activeFilterCount > 0 ? ` with ${activeFilterCount} active filter${activeFilterCount > 1 ? 's' : ''}` : ''}</p>
                                    </div>
                                    <span className="text-[11px] font-bold uppercase text-gray-400">Total {sortedProducts.length} Items</span>
                                </div>
                                {sortedProducts.length > 0 ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">{sortedProducts.map((product) => <ProductCard key={product.id || product._id} product={product} />)}</div> : <div className="py-24 text-center">No products found.</div>}
                            </div>
                        )}
                    </main>
                </div>
            </div>
            {isProductListingView && <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-0 right-0 z-40 flex h-14 border-t bg-white lg:hidden"><button onClick={() => setShowSortModal(true)} className="flex-1 border-r text-xs font-black uppercase tracking-widest">Sort By</button><button onClick={() => setShowFilterModal(true)} className="flex-1 text-xs font-black uppercase tracking-widest">Filters</button></div>}
            <BottomNav />
            {isProductListingView && showSortModal && <div className="fixed inset-0 z-[100] flex items-end"><div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowSortModal(false)} /><div className="relative w-full rounded-t-2xl bg-white p-6 animate-in slide-in-from-bottom duration-300"><div className="mb-4 flex items-center justify-between border-b pb-4"><h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Sort By</h3><button onClick={() => setShowSortModal(false)} className="material-icons text-gray-400">close</button></div><div className="space-y-1">{SORT_OPTIONS.map((option) => <button key={option.id} onClick={() => { setSortBy(option.id); setShowSortModal(false); }} className={`w-full rounded-xl px-4 py-4 text-left text-sm font-bold ${sortBy === option.id ? 'bg-primary-50 text-primary-600' : 'text-gray-600'}`}>{option.label}</button>)}</div></div></div>}
            {isProductListingView && showFilterModal && <div className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-right duration-300"><div className="flex h-full flex-col"><div className="flex items-center justify-between border-b px-5 py-4"><div className="flex items-center gap-4"><button onClick={() => setShowFilterModal(false)} className="material-icons text-gray-900">arrow_back</button><h3 className="text-xs font-black uppercase tracking-widest text-gray-900">Filters</h3></div><button onClick={resetAllFilters} className="text-[11px] font-black uppercase text-primary-600">Clear all</button></div><div className="flex-1 overflow-y-auto p-5"><h4 className="mb-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Price Range</h4><div className="grid grid-cols-2 gap-4"><div className="rounded-lg border border-gray-100 bg-gray-50 p-3"><span className="block text-[9px] font-bold uppercase text-gray-400">Min</span><div className="text-sm font-black">₹{filterRange[0]}</div></div><div className="rounded-lg border border-gray-100 bg-gray-50 p-3"><span className="block text-[9px] font-bold uppercase text-gray-400">Max</span><div className="text-sm font-black">₹{filterRange[1]}</div></div></div><div className="mt-6 space-y-4"><div><h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Customer Ratings</h4><div className="space-y-2">{RATING_OPTIONS.map((rating) => <FilterRadioRow key={rating} name="mobile-rating" checked={selectedRating === rating} onChange={() => setSelectedRating(rating)} label={`${rating}★ & above`} />)}</div></div>{effectiveAvailableBrands.length > 0 && <div><h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Brand</h4><div className="space-y-2">{effectiveAvailableBrands.slice(0, 8).map((brand) => <FilterCheckRow key={brand} checked={selectedBrands.includes(brand)} onChange={() => toggleBrand(brand)} label={brand} />)}</div></div>}</div></div><div className="border-t p-4"><button onClick={() => setShowFilterModal(false)} className="w-full rounded-xl bg-primary-600 py-4 text-xs font-black uppercase tracking-widest text-white">Apply Filters</button></div></div></div>}
        </div>
    );
};

export default CategoryPage;
