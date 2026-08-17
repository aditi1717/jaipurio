import React, { useEffect, useState, useMemo } from 'react';
import { MdInventory, MdRefresh, MdSave, MdSearch, MdClose } from 'react-icons/md';
import { toast } from 'react-hot-toast';
import API from '../../../../services/api';
import Loader from '../../../../components/common/Loader';
import { AdminTableHead, AdminTableHeaderCell, AdminTableHeaderRow } from '../../components/common/AdminTable';
import useCategoryStore from '../../store/categoryStore';
import useSubCategoryStore from '../../store/subCategoryStore';
import Pagination from '../../components/common/Pagination';

const MaxSellingQuantityManager = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingLimits, setEditingLimits] = useState({});

    // Filters and Pagination State
    const categories = useCategoryStore((state) => state.categories);
    const fetchCategories = useCategoryStore((state) => state.fetchCategories);
    const subCategories = useSubCategoryStore((state) => state.subCategories);
    const fetchSubCategories = useSubCategoryStore((state) => state.fetchSubCategories);

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedSubCategory, setSelectedSubCategory] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);

    const fetchProducts = async (showToast = false) => {
        try {
            setLoading(true);
            const params = {
                pageNumber: currentPage,
                limit: itemsPerPage,
                all: 'true',
                lite: 'true'
            };

            if (selectedCategory && selectedCategory !== 'All') {
                params.category = selectedCategory;
            }
            if (selectedSubCategory && selectedSubCategory !== 'All') {
                params.subcategory = selectedSubCategory;
            }
            const searchText = searchTerm.trim();
            if (searchText) {
                params.search = searchText;
            }

            const { data } = await API.get('/products', { params });
            if (data && data.products) {
                setProducts(data.products);
                setTotalPages(data.pages || 1);
                setTotalProducts(data.total || 0);
            } else {
                setProducts(Array.isArray(data) ? data : []);
                setTotalPages(1);
                setTotalProducts(Array.isArray(data) ? data.length : 0);
            }
            if (showToast) toast.success('Product limits synced successfully');
        } catch (error) {
            console.error('Fetch max quantity products error:', error);
            toast.error('Failed to fetch products');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [currentPage, itemsPerPage, selectedCategory, selectedSubCategory, searchTerm]);

    useEffect(() => {
        fetchCategories();
        fetchSubCategories();
    }, [fetchCategories, fetchSubCategories]);

    const handleRefresh = async () => {
        setEditingLimits({});
        if (searchTerm === '' && selectedCategory === 'All' && selectedSubCategory === 'All' && currentPage === 1) {
            await fetchProducts(true);
        } else {
            setSearchTerm('');
            setSelectedCategory('All');
            setSelectedSubCategory('All');
            setCurrentPage(1);
            toast.success('Product limits synced successfully');
        }
    };

    const handleLimitChange = (productId, value) => {
        setEditingLimits((prev) => ({
            ...prev,
            [productId]: value
        }));
    };

    const updateLimit = async (product) => {
        const rawValue = editingLimits[product.id];
        const normalizedValue = Math.max(1, Number(rawValue) || 1);

        try {
            toast.loading('Updating max quantity...', { id: `max-order-qty-${product.id}` });
            const { data } = await API.put(`/products/${product.id}/stock`, {
                maxOrderQuantity: normalizedValue
            });

            setProducts((prev) => prev.map((item) => (
                item.id === product.id ? { ...item, maxOrderQuantity: data.maxOrderQuantity } : item
            )));

            setEditingLimits((prev) => {
                const next = { ...prev };
                delete next[product.id];
                return next;
            });

            toast.success('Max quantity updated', { id: `max-order-qty-${product.id}` });
        } catch (error) {
            console.error('Update max quantity error:', error);
            toast.error(error.response?.data?.message || 'Failed to update max quantity', { id: `max-order-qty-${product.id}` });
        }
    };

    const handleCategoryChange = (e) => {
        setSelectedCategory(e.target.value);
        setSelectedSubCategory('All');
        setCurrentPage(1);
    };

    const handleSubCategoryChange = (e) => {
        setSelectedSubCategory(e.target.value);
        setCurrentPage(1);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleItemsPerPageChange = (e) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedCategory('All');
        setSelectedSubCategory('All');
        setCurrentPage(1);
    };

    const filteredSubCategories = useMemo(() => {
        if (!selectedCategory || selectedCategory === 'All') {
            return subCategories;
        }
        const selectedCategoryObj = categories.find(c => c.name === selectedCategory);
        if (!selectedCategoryObj) return [];
        const catId = selectedCategoryObj.id || selectedCategoryObj._id;
        return subCategories.filter(sub => {
            const subCatId = sub.category?._id || sub.category;
            return String(subCatId) === String(catId);
        });
    }, [subCategories, selectedCategory, categories]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <MdInventory className="text-primary-600" /> Max Selling Quantity
                    </h1>
                    <p className="text-sm text-gray-500 font-medium">Set the maximum quantity a user can buy per product</p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all font-bold text-sm shadow-sm"
                >
                    <MdRefresh size={20} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* Controls */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search products by name or brand..."
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all text-sm font-medium text-gray-900 placeholder:text-gray-500"
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                    
                    {/* Items Per Page Selector */}
                    <div className="flex items-center gap-2 lg:w-48">
                        <span className="text-xs font-bold text-gray-400 uppercase whitespace-nowrap">Page Size:</span>
                        <select
                            value={itemsPerPage}
                            onChange={handleItemsPerPageChange}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all text-sm font-semibold text-gray-700 cursor-pointer"
                        >
                            <option value={10}>10 items</option>
                            <option value={20}>20 items</option>
                            <option value={50}>50 items</option>
                            <option value={100}>100 items</option>
                        </select>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                    <div className="flex flex-col gap-1 min-w-[150px] flex-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Category</label>
                        <select
                            value={selectedCategory}
                            onChange={handleCategoryChange}
                            className="px-3 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all text-sm font-semibold text-gray-700 cursor-pointer animate-none"
                        >
                            <option value="All">All Categories</option>
                            {categories.map((cat) => (
                                <option key={cat.id || cat._id} value={cat.name}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1 min-w-[180px] flex-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Subcategory</label>
                        <select
                            value={selectedSubCategory}
                            onChange={handleSubCategoryChange}
                            className="px-3 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all text-sm font-semibold text-gray-700 cursor-pointer animate-none"
                        >
                            <option value="All">All Subcategories</option>
                            {filteredSubCategories.map((sub) => (
                                <option key={sub._id || sub.id} value={sub._id || sub.id}>
                                    {sub.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {(searchTerm || selectedCategory !== 'All' || selectedSubCategory !== 'All') && (
                        <div className="flex flex-col gap-1 self-end">
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all font-bold text-sm border border-red-100 shadow-sm"
                            >
                                <MdClose size={18} /> Clear Filters
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[300px] flex flex-col justify-between">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <AdminTableHead>
                            <AdminTableHeaderRow>
                                <AdminTableHeaderCell compact>Product Info</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact>Category</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-center">Stock</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-center">Max Qty</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-right">Actions</AdminTableHeaderCell>
                            </AdminTableHeaderRow>
                        </AdminTableHead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <Loader message="Fetching max quantity rules..." />
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => {
                                    const draftValue = editingLimits[product.id];
                                    const effectiveValue = draftValue ?? product.maxOrderQuantity ?? 1;

                                    return (
                                        <tr key={product.id} className="hover:bg-primary-50/10 transition-colors">
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                                                        <img src={product.image} className="w-full h-full object-contain p-1" alt="" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-black text-gray-800 truncate max-w-[240px]">{product.name}</h4>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.14em]">{product.brand || 'No Brand'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className="inline-flex text-[11px] font-bold text-gray-600 px-2 py-1 bg-gray-100 rounded-md">
                                                    {product.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className="text-sm font-black text-primary-600">{Number(product.stock) || 0}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={effectiveValue}
                                                        onChange={(e) => handleLimitChange(product.id, e.target.value)}
                                                        className="w-24 px-2 py-1.5 text-center rounded-lg border-2 bg-white border-primary-100 focus:border-primary-500 text-gray-900 font-black text-sm transition-all outline-none"
                                                    />
                                                </div>
                                                <p className="mt-1 text-[10px] text-gray-400 font-semibold uppercase">
                                                    Default is 1
                                                </p>
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <button
                                                    onClick={() => updateLimit(product)}
                                                    disabled={draftValue === undefined}
                                                    className={`p-2 rounded-lg transition-all shadow-sm border ${
                                                        draftValue !== undefined
                                                            ? 'bg-primary-600 text-white border-primary-700 hover:scale-105 active:scale-95'
                                                            : 'bg-gray-50 text-gray-300 border-transparent cursor-not-allowed'
                                                    }`}
                                                    title="Save max quantity"
                                                >
                                                    <MdSave size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && !loading && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={(page) => setCurrentPage(page)}
                    />
                )}
                {!loading && products.length === 0 && (
                    <div className="p-20 text-center space-y-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                            <MdSearch size={32} className="text-gray-300" />
                        </div>
                        <div>
                            <p className="text-gray-900 font-black tracking-tight">No products found</p>
                            <p className="text-sm text-gray-500 font-medium">Try adjusting your search terms or filters</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MaxSellingQuantityManager;
