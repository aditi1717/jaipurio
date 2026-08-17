import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { useLanguageStore } from '../../../../store/languageStore';
import { useCategories, useProducts } from '../../../../hooks/useData';
import API from '../../../../services/api';
import { IoSearch } from 'react-icons/io5';
import TranslatedText from '../common/TranslatedText';
import { useGoogleTranslation } from '../../../../hooks/useGoogleTranslation';
import {
    MdLocationPin,
    MdStars,
    MdOutlineQrCodeScanner,
    MdHome,
    MdPlayCircleOutline,
    MdLocalOffer,
    MdPersonOutline,
    MdShoppingCart,
    MdExpandMore,
    MdGridView,
    MdCheckroom,
    MdSmartphone,
    MdFace,
    MdLaptop,
    MdShoppingBasket,
    MdKeyboardArrowRight,
    MdArrowBack,
    MdStore,
    MdKitchen,
    MdFlight,
    MdSportsEsports,
    MdCancel
} from 'react-icons/md';
import logo from '../../../../assets/jaipurio-logo.jpeg';

const normalizeSearchText = (value) => String(value || '').trim().toLowerCase();

const getProductId = (product) => String(product?.id || product?._id || '').trim();
const getCategoryId = (category) => String(category?.id || category?._id || category?.name || '').trim();

const scoreSearchMatch = (target, query) => {
    if (!target || !query) return 0;
    if (target === query) return 300;
    if (target.startsWith(query)) return 220;
    if (target.includes(query)) return 140;
    return 0;
};

const dedupeByKey = (items = [], getKey) => {
    const seen = new Set();
    return items.filter((item) => {
        const key = String(getKey(item) || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const getProductSubcategoryText = (product) => {
    const names = [];

    if (Array.isArray(product?.subCategories)) {
        product.subCategories.forEach((entry) => {
            const name = typeof entry === 'string' ? entry : entry?.name;
            if (name) names.push(String(name));
        });
    }

    if (product?.subCategory) {
        names.push(typeof product.subCategory === 'string' ? product.subCategory : product.subCategory?.name);
    }

    if (product?.subcategory) {
        names.push(product.subcategory);
    }

    return names.filter(Boolean).join(' ');
};

const CategoryNavSkeleton = () => (
    <div className="max-w-[1200px] mx-auto relative px-2">
        <div className="flex overflow-x-auto no-scrollbar gap-6 md:gap-10 pt-2 pb-2 border-t border-gray-100">
            {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="flex shrink-0 flex-col items-center gap-2 min-w-[60px]">
                    <div className="w-10 h-10 md:w-16 md:h-16 rounded-full shimmer" />
                    <div className="h-2.5 w-12 md:w-16 rounded shimmer" />
                </div>
            ))}
        </div>
    </div>
);

const Header = () => {
    const totalItems = useCartStore((state) => state.getTotalItems());
    const addresses = useCartStore((state) => state.addresses);
    const primaryAddress = addresses && addresses.length > 0 ? addresses[0] : null;
    const navigate = useNavigate();
    const location = useLocation();
    const { categories, loading: headerLoading } = useCategories({ lite: true });
    const [headerLogo, setHeaderLogo] = useState(logo);

    useEffect(() => {
        const fetchHeaderLogo = async () => {
            try {
                const { data } = await API.get('/settings');
                if (data?.logoUrl && typeof data.logoUrl === 'string' && !data.logoUrl.includes('localhost')) {
                    setHeaderLogo(data.logoUrl);
                }
            } catch (error) {
                console.error('Failed to fetch header logo:', error);
            }
        };

        fetchHeaderLogo();
    }, []);

    // Show active categories directly in homepage strip. No separate manual header config needed.
    const activeHeaderCategories = (categories || []).filter((cat) =>
        cat &&
        cat.active !== false &&
        String(cat?.name || '').trim().length > 0
    );
    // Keep "For You" at first position, but prefer admin-configured category/icon when present.
    const configuredForYouCategory = activeHeaderCategories.find(
        (cat) => String(cat?.name || '').trim().toLowerCase() === 'for you'
    );
    const forYouCategory = configuredForYouCategory || {
        id: 'for-you',
        name: 'For You',
        icon: 'home',
        children: []
    };
    const displayCategories = [
        forYouCategory,
        ...activeHeaderCategories.filter((cat) => String(cat?.name || '').trim().toLowerCase() !== 'for you')
    ];
    const shouldSpreadCategories = displayCategories.length >= 6;
    const { products: searchableProducts = [] } = useProducts({ lite: true });
    const searchableSubCategories = React.useMemo(
        () => dedupeByKey(
            displayCategories.flatMap((category) => {
                const categoryName = String(category?.name || '').trim();
                const subCategories = Array.isArray(category?.children) && category.children.length > 0
                    ? category.children
                    : (Array.isArray(category?.subCategories) ? category.subCategories : []);

                return subCategories.map((subCategory) => ({
                    _id: subCategory?._id || subCategory?.id || `${categoryName}-${subCategory?.name || ''}`,
                    id: subCategory?.id || subCategory?._id || `${categoryName}-${subCategory?.name || ''}`,
                    name: String(subCategory?.name || '').trim(),
                    category: {
                        name: categoryName
                    }
                }));
            }),
            (item) => `${item?.category?.name || ''}::${item?.name || ''}`
        ),
        [displayCategories]
    );


    // Mega menu state
    const [hoveredCategory, setHoveredCategory] = useState(null);
    const [hoveredSubcategory, setHoveredSubcategory] = useState(null);
    const [subcategoryProducts, setSubcategoryProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const hoverTimeoutRef = useRef(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState({ products: [], categories: [], subCategories: [] });
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);

    // Fetch search results as user types (debounced)
    useEffect(() => {
        const fetchSearchResults = async () => {
            if (!searchQuery.trim() || searchQuery.length < 2) {
                setSearchResults({ products: [], categories: [], subCategories: [] });
                setShowSearchDropdown(false);
                return;
            }

            setIsSearching(true);
            try {
                const { data } = await API.get(`/search?q=${searchQuery}`);
                const normalizedQuery = normalizeSearchText(searchQuery);
                const fallbackProducts = (searchableProducts || [])
                    .map((product) => {
                        const name = normalizeSearchText(product?.name);
                        const brand = normalizeSearchText(product?.brand);
                        const category = normalizeSearchText(typeof product?.category === 'string' ? product.category : product?.category?.name);
                        const subcategory = normalizeSearchText(getProductSubcategoryText(product));
                        const tags = Array.isArray(product?.tags) ? product.tags.map((tag) => normalizeSearchText(tag)).join(' ') : '';
                        const haystack = [name, brand, category, subcategory, tags].filter(Boolean).join(' ');

                        if (!haystack.includes(normalizedQuery)) return null;

                        const exactName = name === normalizedQuery;
                        const startsWithName = name.startsWith(normalizedQuery);
                        const subcategoryMatch = subcategory.includes(normalizedQuery);

                        return {
                            product,
                            score: exactName ? 300 : startsWithName ? 220 : subcategoryMatch ? 180 : 120
                        };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.score - a.score)
                    .map((entry) => entry.product);

                const backendProducts = Array.isArray(data?.products) ? data.products : [];
                const backendCategories = Array.isArray(data?.categories) ? data.categories : [];
                const backendSubCategories = Array.isArray(data?.subCategories) ? data.subCategories : [];
                const fallbackCategories = displayCategories
                    .map((category) => {
                        const score = scoreSearchMatch(normalizeSearchText(category?.name), normalizedQuery);
                        if (!score) return null;
                        return { category, score };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.score - a.score)
                    .map((entry) => entry.category);
                const fallbackSubCategories = searchableSubCategories
                    .map((subCategory) => {
                        const subName = normalizeSearchText(subCategory?.name);
                        const combinedName = `${normalizeSearchText(subCategory?.category?.name)} ${subName}`.trim();
                        const score = Math.max(
                            scoreSearchMatch(subName, normalizedQuery),
                            scoreSearchMatch(combinedName, normalizedQuery)
                        );
                        if (!score) return null;
                        return { subCategory, score };
                    })
                    .filter(Boolean)
                    .sort((a, b) => b.score - a.score)
                    .map((entry) => entry.subCategory);
                const mergedProductsMap = new Map();
                [...backendProducts, ...fallbackProducts].forEach((product) => {
                    const key = getProductId(product);
                    if (!key || mergedProductsMap.has(key)) return;
                    mergedProductsMap.set(key, product);
                });
                const mergedCategories = dedupeByKey(
                    [...backendCategories, ...fallbackCategories],
                    (category) => getCategoryId(category)
                ).slice(0, 5);
                const mergedSubCategories = dedupeByKey(
                    [...backendSubCategories, ...fallbackSubCategories],
                    (subCategory) => `${subCategory?.category?.name || ''}::${subCategory?._id || subCategory?.id || subCategory?.name || ''}`
                ).slice(0, 6);

                setSearchResults({
                    categories: mergedCategories,
                    subCategories: mergedSubCategories,
                    products: Array.from(mergedProductsMap.values()).slice(0, 8)
                });
                setShowSearchDropdown(
                    mergedCategories.length > 0
                    || mergedSubCategories.length > 0
                    || mergedProductsMap.size > 0
                );
            } catch (error) {
                console.error("Search failed:", error);
                const normalizedQuery = normalizeSearchText(searchQuery);
                const fallbackProducts = (searchableProducts || [])
                    .filter((product) => {
                        const haystack = [
                            normalizeSearchText(product?.name),
                            normalizeSearchText(product?.brand),
                            normalizeSearchText(typeof product?.category === 'string' ? product.category : product?.category?.name),
                            normalizeSearchText(getProductSubcategoryText(product)),
                            Array.isArray(product?.tags) ? product.tags.map((tag) => normalizeSearchText(tag)).join(' ') : ''
                        ].filter(Boolean).join(' ');

                        return haystack.includes(normalizedQuery);
                    })
                    .slice(0, 8);
                const fallbackCategories = displayCategories
                    .filter((category) => scoreSearchMatch(normalizeSearchText(category?.name), normalizedQuery) > 0)
                    .slice(0, 5);
                const fallbackSubCategories = searchableSubCategories
                    .filter((subCategory) => {
                        const subName = normalizeSearchText(subCategory?.name);
                        const combinedName = `${normalizeSearchText(subCategory?.category?.name)} ${subName}`.trim();
                        return Math.max(
                            scoreSearchMatch(subName, normalizedQuery),
                            scoreSearchMatch(combinedName, normalizedQuery)
                        ) > 0;
                    })
                    .slice(0, 6);

                setSearchResults({
                    products: fallbackProducts,
                    categories: fallbackCategories,
                    subCategories: fallbackSubCategories
                });
                setShowSearchDropdown(
                    fallbackProducts.length > 0
                    || fallbackCategories.length > 0
                    || fallbackSubCategories.length > 0
                );
            } finally {
                setIsSearching(false);
            }
        };

        const debounceTimer = setTimeout(fetchSearchResults, 300);
        return () => clearTimeout(debounceTimer);
    }, [displayCategories, searchQuery, searchableProducts, searchableSubCategories]);

    // Close search dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('.search-container')) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Icon Mapping for dynamic data
    const iconMap = {
        // Categories
        'grid_view': MdGridView,
        'checkroom': MdCheckroom,
        'smartphone': MdSmartphone,
        'face': MdFace,
        'laptop': MdLaptop,
        'home': MdHome,
        'shopping_basket': MdShoppingBasket,
        'kitchen': MdKitchen,
        'flight': MdFlight,
        'sports_esports': MdSportsEsports,
        // Nav Items
        'play_circle_outline': MdPlayCircleOutline,
        'local_offer': MdLocalOffer,
        'person_outline': MdPersonOutline,
        'shopping_cart': MdShoppingCart,
    };

    // Fetch products when hovering on a subcategory
    useEffect(() => {
        const fetchProducts = async () => {
            if (!hoveredSubcategory || !hoveredCategory) {
                setSubcategoryProducts([]);
                return;
            }

            setLoadingProducts(true);
            try {
                const { data } = await API.get(`/products?category=${hoveredCategory}&subcategory=${hoveredSubcategory}`);
                setSubcategoryProducts(data.slice(0, 6)); // Limit to 6 products
            } catch (error) {
                console.error('Error fetching products:', error);
                setSubcategoryProducts([]);
            } finally {
                setLoadingProducts(false);
            }
        };

        fetchProducts();
    }, [hoveredSubcategory, hoveredCategory]);

    // Helper to check active state
    const isActiveCategory = (catName) => {
        if (catName === "For You" && location.pathname === "/") return true;
        const decodedPath = decodeURIComponent(location.pathname || '');
        return decodedPath.includes(`/category/${catName}`);
    };

    const isPDP = location.pathname.includes('/product/');
    const isCategory = location.pathname.includes('/category/');
    const isInfoPage = location.pathname.includes('/info');
    const isSpecialPage = isPDP || isCategory;

    const handleBackNavigation = () => {
        // Use React Router history index when available; fallback to home.
        if (window.history.state?.idx > 0) {
            navigate(-1);
            return;
        }
        navigate('/');
    };

    // Translation State
    const { language, setLanguage } = useLanguageStore();
    const searchPlaceholder = useGoogleTranslation('Search for products, categories, subcategories and more');
    const myAccountText = useGoogleTranslation('My Account');
    const cartText = useGoogleTranslation('Cart');
    const categoriesText = useGoogleTranslation('Categories');
    const cleanNavLabel = (text) => String(text || '').replace(/:/g, '').trim();
    const buildCategoryRoute = (categoryName, subCategoryName) => {
        const categorySegment = encodeURIComponent(String(categoryName || '').trim());
        if (!subCategoryName) return `/category/${categorySegment}`;
        const subCategorySegment = encodeURIComponent(String(subCategoryName).trim());
        return `/category/${categorySegment}/${subCategorySegment}`;
    };
    const handleSearchSelection = (targetPath) => {
        if (!targetPath) return;
        navigate(targetPath);
        setShowSearchDropdown(false);
        setSearchQuery('');
    };
    const handleSearchSubmit = () => {
        const firstCategory = searchResults.categories?.[0];
        const firstSubCategory = searchResults.subCategories?.[0];
        const firstProduct = searchResults.products?.[0];

        if (firstCategory?.name) {
            handleSearchSelection(buildCategoryRoute(firstCategory.name));
            return;
        }

        if (firstSubCategory?.name && firstSubCategory?.category?.name) {
            handleSearchSelection(buildCategoryRoute(firstSubCategory.category.name, firstSubCategory.name));
            return;
        }

        if (firstProduct) {
            handleSearchSelection(`/product/${firstProduct.id || firstProduct._id}`);
        }
    };

    return (
        <header className={`${isPDP ? 'bg-gradient-to-b from-primary-100 to-primary-200' : 'bg-gradient-to-b from-primary-200 via-primary-100 to-primary-50'} px-3 fixed top-0 w-full left-0 right-0 z-50 transition-all duration-300 shadow-none ${isInfoPage ? 'border-b-0' : 'border-b border-primary-200'} ${isPDP ? 'py-1.5' : isCategory ? 'py-2' : 'py-0.5 md:py-0'} ${!isInfoPage && (isPDP ? 'md:border-primary-100' : 'border-primary-200/50 md:border-gray-100')}`}>
            <div className={`max-w-[1440px] mx-auto flex ${isPDP ? 'flex-row items-center gap-2' : 'flex-col'} md:flex-row md:items-center md:gap-8`}>

                {/* Mobile Top Row: Logo (Left) + Seller Button (Right) - Hidden on mobile PDP to match single row design */}
                <div className={`${isPDP ? 'hidden md:flex' : 'flex'} items-center justify-between mb-0 md:mb-0 w-full md:w-auto`}>
                    {/* Mobile Logo - Only on Homepage */}
                    {location.pathname === '/' && (
                        <div
                            className="flex items-center md:hidden -my-4 cursor-pointer shrink-0"
                            onClick={() => navigate('/')}
                        >
                            <img src={headerLogo} alt="Jaipurio" className="h-32 object-contain" onError={(e) => { e.target.src = logo; }} />
                        </div>
                    )}

                    {/* Desktop Logo */}
                    <div
                        className="hidden md:flex flex-col cursor-pointer"
                        onClick={() => navigate('/')}
                    >
                        <img src={headerLogo} alt="Jaipurio" className="h-[70px] lg:h-[100px] object-contain" onError={(e) => { e.target.src = logo; }} />
                    </div>

                    {/* Mobile Header Actions (Seller + Language) - Only on Homepage */}
                    {location.pathname === '/' && (
                        <div className="md:hidden flex items-center gap-2">
                            {/* Become a Seller Button (Mobile) */}
                            <div
                                onClick={() => navigate('/become-seller')}
                                className="flex items-center gap-1.5 bg-primary-50 px-2.5 py-1.5 rounded-lg border border-primary-100 shadow-sm active:scale-95 transition-all"
                            >
                                <MdStore className="text-primary-600" size={16} />
                                <span className="text-[10px] font-black text-primary-600 uppercase tracking-tight">Become a Seller</span>
                            </div>

                            {/* Language Switcher (Mobile) */}
                            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                <button
                                    onClick={() => setLanguage('en')}
                                    className={`text-[9px] font-black px-2 py-1 rounded transition-all ${language === 'en' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}
                                >
                                    EN
                                </button>
                                <button
                                    onClick={() => setLanguage('hi')}
                                    className={`text-[9px] font-black px-2 py-1 rounded transition-all ${language === 'hi' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400'}`}
                                >
                                    HI
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Mobile Address - Moved Above Search */}
                {!isSpecialPage && (
                    <div
                        onClick={() => navigate('/addresses')}
                        className="flex md:hidden w-full mb-2 items-center gap-1 bg-primary-50/50 p-1.5 rounded-lg border border-primary-100 cursor-pointer active:bg-primary-100 transition-colors"
                    >
                        <MdLocationPin className="text-sm text-primary-600 shrink-0" />
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span className="text-gray-900 text-xs font-bold whitespace-nowrap">
                                {primaryAddress ? `Delivering to ${primaryAddress.pincode}` : 'Select Location'}
                            </span>
                            <span className="text-gray-500 text-[10px] font-medium truncate">
                                {primaryAddress ? `- ${primaryAddress.city}` : '- Update location'}
                            </span>
                        </div>
                        <MdKeyboardArrowRight className="text-sm text-gray-400 shrink-0" />
                    </div>
                )}

                {/* Search Bar Row */}
                <div className={`flex items-center gap-2 flex-1 mt-0 md:gap-3 md:mt-0 relative search-container`}>
                    {/* Mobile Back Button (Only on PDP) */}


                    <div className={`flex-1 bg-white rounded-lg flex items-center px-3 md:px-4 shadow-sm md:shadow-none overflow-hidden h-10 md:h-11 border transition-all ${isPDP ? 'border-primary-400 md:border-gray-200' : 'border-gray-200'} focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-100`}>
                        <IoSearch className={`text-gray-400 md:text-gray-500 text-[18px] md:text-[20px] mr-2 md:mr-3 ${isSearching ? 'animate-pulse' : ''}`} />
                        <input
                            className="bg-transparent border-none focus:ring-0 text-[14px] md:text-[15px] w-full p-0 outline-none placeholder-gray-400 md:placeholder-gray-500 text-black md:text-gray-800 h-full flex items-center font-normal"
                            placeholder={searchPlaceholder}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSearchSubmit();
                                }
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchResults({ products: [], categories: [], subCategories: [] });
                                    setShowSearchDropdown(false);
                                }}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <MdCancel className="text-gray-400" size={18} />
                            </button>
                        )}
                    </div>

                    {/* Search Results Dropdown */}
                    {showSearchDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-top-2">
                            {/* Categories & Subcategories Section */}
                            {(searchResults.categories?.length > 0 || searchResults.subCategories?.length > 0) && (
                                <div className="p-2 border-b border-gray-50">
                                    <div className="flex flex-wrap gap-2">
                                        {searchResults.categories?.map(cat => (
                                            <button
                                                key={getCategoryId(cat)}
                                                onClick={() => handleSearchSelection(buildCategoryRoute(cat.name))}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-600 rounded-full text-xs font-bold hover:bg-primary-600 hover:text-white transition-all"
                                            >
                                                <MdGridView size={14} />
                                                {cat.name}
                                            </button>
                                        ))}
                                        {searchResults.subCategories?.map(sub => (
                                            <button
                                                key={`${sub.category?.name || 'category'}-${sub._id || sub.id || sub.name}`}
                                                onClick={() => handleSearchSelection(buildCategoryRoute(sub.category?.name, sub.name))}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full text-xs font-bold hover:bg-gray-600 hover:text-white transition-all"
                                            >
                                                <MdKeyboardArrowRight size={14} />
                                                {sub.name} in <span className="opacity-70">{sub.category?.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Products Section */}
                            <div className="p-2">
                                <h3 className="px-3 py-1 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Products</h3>
                                {searchResults.products?.length > 0 ? (
                                    <div className="space-y-1">
                                        {searchResults.products.map(product => (
                                            <div
                                                key={product.id || product._id}
                                                onClick={() => handleSearchSelection(`/product/${product.id || product._id}`)}
                                                className="flex items-center gap-4 p-2 hover:bg-primary-50 rounded-lg cursor-pointer transition-colors group"
                                            >
                                                <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden flex-shrink-0 border border-gray-100">
                                                    <img
                                                        src={product.image}
                                                        alt={product.name}
                                                        className="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-gray-900 truncate group-hover:text-primary-600 transition-colors">{product.name}</h4>
                                                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">
                                                        {product.brand} • <span className="text-primary-600 font-bold">{product.category}</span>
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-gray-900">₹{(product.skus?.[0]?.price ?? product.price)?.toLocaleString()}</div>
                                                    {product.discount > 0 && (
                                                        <div className="text-[9px] font-bold text-green-600 bg-green-50 px-1 rounded inline-block">{product.discount}% OFF</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center">
                                        <p className="text-sm text-gray-400 font-medium italic">No products found matching "{searchQuery}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Cart Icon (Only Visible on Mobile Special Pages) */}
                    {isSpecialPage && (
                        <div
                            onClick={() => navigate('/cart')}
                            className="md:hidden flex items-center justify-center h-10 w-10 flex-shrink-0 relative pointer-events-auto cursor-pointer"
                        >
                            <MdShoppingCart className="text-gray-700 text-[24px]" />
                            {totalItems > 0 && (
                                <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                                    {totalItems}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center gap-6 ml-auto">
                    {/* Language Switcher (Desktop) */}
                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                        <button
                            onClick={() => { console.log('Clicked EN'); setLanguage('en'); }}
                            className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${language === 'en' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <span className="font-sans">EN</span>
                        </button>
                        <button
                            onClick={() => { console.log('Clicked HI'); setLanguage('hi'); }}
                            className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${language === 'hi' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <span className="font-serif">HI</span>
                        </button>
                    </div>

                    {/* Become a Seller */}
                    <div
                        onClick={() => navigate('/become-seller')}
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors border border-gray-100 shadow-sm bg-white group ring-1 ring-black/5 hover:ring-primary-100"
                    >
                        <MdStore className="text-[24px] text-gray-700 group-hover:text-primary-600 transition-colors" />
                        <span className="text-gray-800 font-bold text-[15px] whitespace-nowrap">Become a Seller</span>
                    </div>

                    {/* Account */}
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-primary-50 px-3 py-2 rounded-lg transition-colors group" onClick={() => navigate('/account')}>
                        <MdPersonOutline className="text-[24px] text-gray-700" />
                        <span className="text-gray-800 font-medium text-[15px]">{myAccountText}</span>
                        <MdExpandMore className="text-gray-700 transition-transform group-hover:rotate-180" />
                    </div>

                    {/* Cart */}
                    <div onClick={() => navigate('/cart')} className="flex items-center gap-2 cursor-pointer hover:bg-primary-50 px-3 py-2 rounded-lg transition-colors relative">
                        <div className="relative">
                            <MdShoppingCart className="text-[24px] text-gray-700" />
                            {totalItems > 0 && <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">{totalItems}</div>}
                        </div>
                        <span className="text-gray-800 font-medium text-[15px]">{cartText}</span>
                    </div>

                </div>
            </div>

            {/* Category Navigation - Only on Homepage */}
            {location.pathname === '/' && (
                <>
                    {headerLoading && displayCategories.length === 0 && <CategoryNavSkeleton />}
                    {displayCategories.length > 0 && (
                        <div className="max-w-[1200px] mx-auto relative px-2">
                            <div className={`flex overflow-x-auto md:overflow-visible no-scrollbar gap-6 md:gap-10 pt-2 pb-2 md:pt-2 md:pb-2 mt-0 md:-mt-2 border-t border-gray-100 touch-pan-x overscroll-x-contain snap-x snap-mandatory scroll-smooth [scrollbar-gutter:stable] ${shouldSpreadCategories ? 'md:justify-between' : 'md:justify-start'}`}>
                                {displayCategories.map((cat, index) => {
                            const active = isActiveCategory(cat.name);
                            const IconComponent = iconMap[cat.icon] || MdGridView;
                            const categoryImage = cat.icon || cat.image || '';
                            const hasCategoryImage =
                                typeof categoryImage === 'string' &&
                                (categoryImage.startsWith('http') ||
                                    categoryImage.startsWith('/') ||
                                    categoryImage.startsWith('data:') ||
                                    categoryImage.startsWith('blob:'));
                            const isHovered = false;
                            const isRightSide = index > displayCategories.length / 2;

                            return (
                                <div
                                    key={cat.id || cat._id || cat.name}
                                    onClick={() => cat.name === "For You" ? navigate('/') : navigate(buildCategoryRoute(cat.name))}
                                    onMouseEnter={() => {
                                        if (window.innerWidth >= 768) { // Desktop only
                                            if (hoverTimeoutRef.current) {
                                                clearTimeout(hoverTimeoutRef.current);
                                                hoverTimeoutRef.current = null;
                                            }
                                            setHoveredCategory(cat.name);
                                            const subcats = cat.children || cat.subCategories || [];
                                            if (subcats.length > 0) {
                                                setHoveredSubcategory(subcats[0].name);
                                            }
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        if (window.innerWidth >= 768) {
                                            hoverTimeoutRef.current = setTimeout(() => {
                                                setHoveredCategory(null);
                                                setHoveredSubcategory(null);
                                            }, 150); // Small delay to prevent accidental closure
                                        }
                                    }}
                                    className="relative flex shrink-0 flex-col items-center gap-1 min-w-[60px] cursor-pointer group snap-start"
                                >
                                    <div className={`w-10 h-10 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all overflow-hidden ${active ? 'bg-white ring-2 ring-primary-600 scale-105 shadow-md' : 'bg-white text-gray-600 group-hover:bg-primary-50 group-hover:text-primary-600 border border-gray-100 shadow-sm'}`}>
                                        {hasCategoryImage ? (
                                            <img
                                                src={categoryImage}
                                                alt={cat.name}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    const fallback = e.currentTarget.nextElementSibling;
                                                    if (fallback) fallback.style.display = 'block';
                                                }}
                                            />
                                        ) : null}
                                        <IconComponent
                                            className={cat.name === 'For You' ? 'text-[24px] md:text-[30px]' : 'text-[20px] md:text-2xl'}
                                            style={{ display: hasCategoryImage ? 'none' : 'block' }}
                                        />
                                    </div>
                                    <span className={`text-[10px] md:text-sm font-bold transition-colors ${active ? 'text-primary-600' : 'text-gray-700 group-hover:text-primary-600'}`}>
                                        <TranslatedText text={cleanNavLabel(cat.name)} />
                                    </span>

                                    {/* Mega Menu - Positioned under specific item */}
                                    {isHovered && (cat.children?.length > 0 || cat.subCategories?.length > 0) && (
                                        <div
                                            className={`absolute top-full ${isRightSide ? 'right-0' : 'left-0'} pt-2 bg-transparent hidden md:block z-[100] animate-in fade-in slide-in-from-top-2`}
                                            style={{ minWidth: '700px' }} // Ensure enough width for columns
                                        >
                                            <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden flex relative w-full">
                                                {/* Subcategories Column */}
                                                <div className="w-64 py-2 border-r border-gray-100 bg-gray-50/30">
                                                    <h3 className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 mb-1">
                                                        {categoriesText}
                                                    </h3>
                                                    {(cat.children || cat.subCategories).map((sub) => (
                                                        <div
                                                            key={sub.id || sub._id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(buildCategoryRoute(cat.name, sub.name));
                                                            }}
                                                            onMouseEnter={() => setHoveredSubcategory(sub.name)}
                                                            className={`px-4 py-2.5 text-sm font-medium transition-all cursor-pointer flex items-center justify-between group/sub ${hoveredSubcategory === sub.name
                                                                ? 'bg-primary-50 text-primary-600 border-r-2 border-primary-600'
                                                                : 'text-gray-700 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <span><TranslatedText text={cleanNavLabel(sub.name)} /></span>

                                                            <MdKeyboardArrowRight className={`text-lg transition-transform ${hoveredSubcategory === sub.name ? 'translate-x-1' : ''}`} />
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Products Panel */}
                                                <div className="flex-1 p-6 bg-white overflow-y-auto max-h-[500px]">
                                                    <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-1.5 h-6 bg-primary-600 rounded-full"></span>
                                                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">
                                                                <TranslatedText text={cleanNavLabel(hoveredSubcategory || cat.name)} />
                                                            </h3>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate(buildCategoryRoute(cat.name, hoveredSubcategory));
                                                            }}
                                                            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-full transition-colors uppercase tracking-wide"
                                                        >
                                                            Explore All →
                                                        </button>
                                                    </div>

                                                    {loadingProducts ? (
                                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                                                <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                                                                    <div className="bg-gray-200 h-32 rounded-lg mb-3"></div>
                                                                    <div className="bg-gray-200 h-4 rounded w-3/4 mb-2"></div>
                                                                    <div className="bg-gray-200 h-4 rounded w-1/2"></div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : subcategoryProducts.length > 0 ? (
                                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                                            {subcategoryProducts.map((product) => (
                                                                <div
                                                                    key={product.id || product._id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        navigate(`/product/${product.id || product._id}`);
                                                                        setHoveredCategory(null);
                                                                    }}
                                                                    className="bg-white rounded-xl p-3 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group/product border border-gray-100 hover:border-primary-100"
                                                                >
                                                                    <div className="aspect-square bg-gray-50 rounded-lg mb-3 overflow-hidden relative">
                                                                        <img
                                                                            src={product.images?.[0]?.url || product.image}
                                                                            alt={product.name}
                                                                            className="w-full h-full object-contain p-2 group-hover/product:scale-110 transition-transform duration-500"
                                                                        />
                                                                        {product.discount && (
                                                                            <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm">
                                                                                {product.discount}% OFF
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <h4 className="text-xs font-bold text-gray-800 line-clamp-2 mb-2 group-hover/product:text-primary-600 transition-colors min-h-[32px]">
                                                                        {product.name}
                                                                    </h4>
                                                                    <div className="flex items-center justify-between mt-auto">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-black text-gray-900">
                                                                                ₹{(product.skus?.[0]?.price ?? product.price)?.toLocaleString()}
                                                                            </span>
                                                                            {(product.skus?.[0]?.originalPrice ?? product.originalPrice) > (product.skus?.[0]?.price ?? product.price) && (
                                                                                <span className="text-[10px] text-gray-400 line-through">
                                                                                    ₹{(product.skus?.[0]?.originalPrice ?? product.originalPrice)?.toLocaleString()}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="w-7 h-7 bg-primary-50 group-hover/product:bg-primary-600 text-primary-600 group-hover/product:text-white rounded-full flex items-center justify-center transition-colors">
                                                                            <MdShoppingCart size={14} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-12 bg-gray-50 rounded-2xl">
                                                            <MdShoppingBasket className="mx-auto text-5xl text-gray-200 mb-3" />
                                                            <p className="text-gray-400 font-medium italic">Discover amazing deals soon!</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </header>
    );
};

export default Header;
