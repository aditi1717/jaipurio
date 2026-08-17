import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useProducts, useCategories } from '../../../hooks/useData';
import ProductCard from '../components/product/ProductCard';
import { MdArrowBack, MdFilterList, MdSort, MdClose, MdExpandMore } from 'react-icons/md';

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

const ProductListingPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const title = searchParams.get('title'); // Support Custom Title via Query Param
    const { products, loading: productsLoading } = useProducts({ lite: true });
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [sortedProducts, setSortedProducts] = useState([]);
    const [showSortModal, setShowSortModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [sortBy, setSortBy] = useState('popularity');
    const [filterRange, setFilterRange] = useState([0, 100000]);
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [selectedRam, setSelectedRam] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const { categories } = useCategories({ lite: true });

    useEffect(() => {
        if (!subcategory || category || !categories.length) return;

        // Attempt to find which root category this subcategory belongs to
        for (const cat of categories) {
            const hasSub = cat.children?.some(
                sub => (sub.name || '').toLowerCase() === subcategory.toLowerCase()
            );
            if (hasSub) {
                // Redirect to the richer category page
                navigate(`/category/${encodeURIComponent(cat.name)}/${encodeURIComponent(subcategory)}`, { replace: true });
                return;
            }
        }
    }, [subcategory, category, categories, navigate]);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (productsLoading) return;
        let results = products;

        // Filter by Category
        if (category) {
            results = results.filter(p =>
                p.category?.toLowerCase() === category.toLowerCase() ||
                p.tags?.some(t => t.toLowerCase() === category.toLowerCase())
            );
        }

        // Filter by Subcategory/Tag
        if (subcategory) {
            results = results.filter(p =>
                (p.subCategories && p.subCategories.some(sub => (sub.name || '').toLowerCase() === subcategory.toLowerCase())) ||
                (p.subCategory?.name || p.subcategory || '').toLowerCase() === subcategory.toLowerCase() ||
                p.tags?.some(t => t.toLowerCase() === subcategory.toLowerCase()) ||
                (p.brand || '').toLowerCase() === subcategory.toLowerCase() ||
                p.name?.toLowerCase().includes(subcategory.toLowerCase())
            );
        }

        setFilteredProducts(results);
        setSortedProducts(results);
    }, [category, subcategory, products, productsLoading]);

    useEffect(() => {
        let updated = [...filteredProducts];

        // Apply Price Filter
        updated = updated.filter(p => p.price >= filterRange[0] && p.price <= filterRange[1]);

        // Apply Category Filter
        if (selectedCategories.length > 0) {
            updated = updated.filter(p => p.category && selectedCategories.includes(p.category));
        }

        // Apply Brand Filter
        if (selectedBrands.length > 0) {
            updated = updated.filter(p => p.brand && selectedBrands.includes(p.brand));
        }

        // Apply RAM Filter
        if (selectedRam.length > 0) {
            updated = updated.filter(p => p.ram && selectedRam.includes(p.ram));
        }

        // Apply Sorting
        if (sortBy === 'price-low') {
            updated.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price-high') {
            updated.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'rating') {
            updated.sort((a, b) => b.rating - a.rating);
        }

        setSortedProducts(updated);
    }, [sortBy, filterRange, selectedBrands, selectedRam, selectedCategories, filteredProducts]);

    // Unique options
    const availableBrands = getDistinctValues(filteredProducts, (product) => product?.brand);
    const fallbackBrandName = String(subcategory || '').trim();
    const effectiveAvailableBrands = availableBrands.length > 0
        ? availableBrands
        : (fallbackBrandName && filteredProducts.length > 0 ? [fallbackBrandName] : []);
    const availableRam = getDistinctValues(filteredProducts, (product) => product?.ram);
    const availableCategories = getDistinctValues(filteredProducts, (product) => product?.category);

    const toggleBrand = (brand) => {
        setSelectedBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]);
    };

    const toggleRam = (ram) => {
        setSelectedRam(prev => prev.includes(ram) ? prev.filter(r => r !== ram) : [...prev, ram]);
    };

    const toggleCategory = (category) => {
        setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]);
    };

    const handlePriceInputChange = (index, value) => {
        const numValue = parseInt(value) || 0;
        const newRange = [...filterRange];
        newRange[index] = numValue;
        setFilterRange(newRange);
    };

    return (
        <div className="bg-gray-50 min-h-screen pb-20 pt-2">
            {/* Header / Back Navigation */}
            <div className="bg-white sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <MdArrowBack onClick={() => navigate(-1)} className="text-2xl text-gray-700 cursor-pointer" />
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold text-gray-800 capitalize leading-none">
                            {title || subcategory || category || 'Products'}
                        </h1>
                        <span className="text-xs text-gray-500">{sortedProducts.length} items</span>
                    </div>
                </div>

                {/* Desktop Sort Dropdown */}
                <div className="hidden md:flex items-center gap-4 relative">
                    <span className="text-[12px] font-black text-gray-400 uppercase tracking-widest">Sort By:</span>
                    <div className="relative">
                        <button
                            onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                            className="flex items-center gap-3 bg-gray-50 border border-gray-100 px-4 py-2 rounded-lg hover:border-primary-500 transition-all shadow-sm group"
                        >
                            <span className="text-sm font-bold text-gray-700 capitalize">
                                {[
                                    { id: 'popularity', label: 'Popularity' },
                                    { id: 'price-low', label: 'Price: Low to High' },
                                    { id: 'price-high', label: 'Price: High to Low' },
                                    { id: 'newest', label: 'Newest First' },
                                ].find(opt => opt.id === sortBy)?.label}
                            </span>
                            <MdExpandMore className={`text-xl text-gray-400 group-hover:text-primary-500 transition-transform duration-300 ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isSortDropdownOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setIsSortDropdownOpen(false)}
                                ></div>
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 z-20 animate-in fade-in zoom-in duration-200">
                                    {[
                                        { id: 'popularity', label: 'Popularity', desc: 'Highest rated first' },
                                        { id: 'price-low', label: 'Price: Low to High', desc: 'Budget friendly first' },
                                        { id: 'price-high', label: 'Price: High to Low', desc: 'Premium first' },
                                        { id: 'newest', label: 'Newest First', desc: 'Freshly arrival first' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => {
                                                setSortBy(opt.id);
                                                setIsSortDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-5 py-3 transition-colors hover:bg-primary-50 group ${sortBy === opt.id ? 'bg-primary-50/50' : ''
                                                }`}
                                        >
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-bold ${sortBy === opt.id ? 'text-primary-600' : 'text-gray-700'}`}>
                                                    {opt.label}
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-medium">{opt.desc}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 px-2">
                {productsLoading ? (
                    <div className="col-span-full text-center py-20">
                        <p className="text-gray-500">Loading products...</p>
                    </div>
                ) : sortedProducts.length > 0 ? (
                    sortedProducts.map(product => (
                        <ProductCard key={product.id || product._id} product={product} />
                    ))
                ) : (
                    <div className="col-span-full text-center py-20">
                        <p className="text-gray-500">No products found for this category.</p>
                    </div>
                )}
            </div>

            {/* Bottom Filter Bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-3 px-4 flex items-center justify-between md:hidden z-20">
                <button
                    onClick={() => setShowSortModal(true)}
                    className="flex items-center gap-2 w-1/2 justify-center border-r border-gray-200"
                >
                    <MdSort className="text-lg text-gray-700" />
                    <span className="text-sm font-semibold text-gray-800">Sort</span>
                </button>
                <button
                    onClick={() => setShowFilterModal(true)}
                    className="flex items-center gap-2 w-1/2 justify-center"
                >
                    <MdFilterList className="text-lg text-gray-700" />
                    <span className="text-sm font-semibold text-gray-800">Filter</span>
                </button>
            </div>

            {/* Sort Modal (Bottom Sheet) */}
            {showSortModal && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSortModal(false)}></div>
                    <div className="relative w-full bg-white rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 overflow-hidden">
                        <div className="px-6 py-4 border-b flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 uppercase text-xs tracking-widest">Sort By</h3>
                            <button onClick={() => setShowSortModal(false)} className="material-icons text-gray-400">close</button>
                        </div>
                        <div className="p-2">
                            {[
                                { id: 'popularity', label: 'Popularity', icon: 'stars' },
                                { id: 'price-low', label: 'Price -- Low to High', icon: 'trending_up' },
                                { id: 'price-high', label: 'Price -- High to Low', icon: 'trending_down' },
                                { id: 'newest', label: 'Newest First', icon: 'new_releases' },
                            ].map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => { setSortBy(option.id); setShowSortModal(false); }}
                                    className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${sortBy === option.id ? 'bg-primary-50 text-primary-600' : 'text-gray-600 active:bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-icons-outlined text-lg">{option.icon}</span>
                                        <span className="font-bold text-sm tracking-tight">{option.label}</span>
                                    </div>
                                    {sortBy === option.id && <span className="material-icons text-lg">check_circle</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Modal (Right Side Slide-in) */}
            {showFilterModal && (
                <div className="fixed inset-0 z-[100]">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowFilterModal(false)}></div>
                    <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="px-6 py-4 border-b flex items-center justify-between">
                            <h3 className="font-bold text-gray-800 uppercase text-xs tracking-widest">Filters</h3>
                            <button onClick={() => setShowFilterModal(false)}>
                                <MdClose className="text-2xl text-gray-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Category Filter */}
                            {availableCategories.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">Category</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {availableCategories.map((cat) => (
                                            <button
                                                key={cat}
                                                onClick={() => toggleCategory(cat)}
                                                className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${selectedCategories.includes(cat)
                                                    ? 'border-primary-600 bg-primary-50 text-primary-600'
                                                    : 'border-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Brand Filter */}
                            {effectiveAvailableBrands.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">Brand</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {effectiveAvailableBrands.map((brand) => (
                                            <button
                                                key={brand}
                                                onClick={() => toggleBrand(brand)}
                                                className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${selectedBrands.includes(brand)
                                                    ? 'border-primary-600 bg-primary-50 text-primary-600'
                                                    : 'border-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {brand}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* RAM Filter */}
                            {availableRam.length > 0 && (
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-4">RAM</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {availableRam.map((ram) => (
                                            <button
                                                key={ram}
                                                onClick={() => toggleRam(ram)}
                                                className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${selectedRam.includes(ram)
                                                    ? 'border-primary-600 bg-primary-50 text-primary-600'
                                                    : 'border-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {ram}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Price Range */}
                            <div>
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-6">Price Range</h4>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <div className="bg-gray-50 px-4 py-2 rounded-lg border focus-within:border-primary-500 transition-colors">
                                            <span className="text-[10px] text-gray-400 block uppercase font-bold">Min</span>
                                            <div className="flex items-center gap-0.5">
                                                <span className="font-black text-sm text-gray-900">₹</span>
                                                <input
                                                    type="number"
                                                    value={filterRange[0]}
                                                    onChange={(e) => handlePriceInputChange(0, e.target.value)}
                                                    className="w-full bg-transparent font-black text-sm text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                            </div>
                                        </div>
                                        <div className="w-8 h-[2px] bg-gray-200"></div>
                                        <div className="bg-gray-50 px-4 py-2 rounded-lg border focus-within:border-primary-500 transition-colors">
                                            <span className="text-[10px] text-gray-400 block uppercase font-bold">Max</span>
                                            <div className="flex items-center gap-0.5">
                                                <span className="font-black text-sm text-gray-900">₹</span>
                                                <input
                                                    type="number"
                                                    value={filterRange[1]}
                                                    onChange={(e) => handlePriceInputChange(1, e.target.value)}
                                                    className="w-full bg-transparent font-black text-sm text-gray-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { label: 'Under ₹500', range: [0, 500] },
                                            { label: '₹500 - ₹2000', range: [500, 2000] },
                                            { label: '₹2000 - ₹5000', range: [2000, 5000] },
                                            { label: 'Above ₹5000', range: [5000, 1000000] },
                                        ].map((r) => (
                                            <button
                                                key={r.label}
                                                onClick={() => setFilterRange(r.range)}
                                                className={`px-3 py-2.5 rounded-lg border transition-all text-xs font-bold leading-tight ${JSON.stringify(filterRange) === JSON.stringify(r.range)
                                                    ? 'border-primary-600 bg-primary-50 text-primary-600'
                                                    : 'border-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-white flex gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                            <button
                                onClick={() => {
                                    setFilterRange([0, 100000]);
                                    setSelectedBrands([]);
                                    setSelectedRam([]);
                                    setSelectedCategories([]);
                                }}
                                className="flex-1 py-4 text-gray-400 font-black uppercase text-xs tracking-widest hover:text-gray-600"
                            >
                                Clear All
                            </button>
                            <button
                                onClick={() => setShowFilterModal(false)}
                                className="flex-[2] bg-[#fb641b] text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-[#fb641b]/20 active:scale-95 transition-all"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductListingPage;
