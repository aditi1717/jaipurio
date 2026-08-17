import React, { useState, useEffect, useMemo } from 'react';
import { MdSearch, MdInventory, MdExpandMore, MdExpandLess, MdSave, MdRefresh, MdFileDownload, MdFileUpload, MdClose, MdCheckCircle, MdWarning } from 'react-icons/md';
import API from '../../../../services/api';
import { toast } from 'react-hot-toast';
import Loader from '../../../../components/common/Loader';
import { AdminTableHead, AdminTableHeaderCell, AdminTableHeaderRow } from '../../components/common/AdminTable';
import { getAdminListCache, setAdminListCache } from '../../utils/adminListCache';
import useCategoryStore from '../../store/categoryStore';
import useSubCategoryStore from '../../store/subCategoryStore';
import Pagination from '../../components/common/Pagination';

const STOCK_PRODUCTS_CACHE_KEY = 'admin-products:stock-lite';

const StockManagement = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedProduct, setExpandedProduct] = useState(null);
    const [editingStock, setEditingStock] = useState({}); // { productId: value, "productId-skuIndex": value }
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [showResultModal, setShowResultModal] = useState(false);

    // Filters and Pagination State
    const categories = useCategoryStore((state) => state.categories);
    const fetchCategories = useCategoryStore((state) => state.fetchCategories);
    const subCategories = useSubCategoryStore((state) => state.subCategories);
    const fetchSubCategories = useSubCategoryStore((state) => state.fetchSubCategories);

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedSubCategory, setSelectedSubCategory] = useState('All');
    const [stockStatusFilter, setStockStatusFilter] = useState('All');
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
            if (stockStatusFilter && stockStatusFilter !== 'All') {
                params.stockStatus = stockStatusFilter;
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
            if (showToast) toast.success('Inventory synced successfully');
        } catch (error) {
            console.error('Fetch products error:', error);
            toast.error('Failed to fetch products');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setEditingStock({});
        setExpandedProduct(null);
        setImportResult(null);
        if (searchTerm === '' && selectedCategory === 'All' && selectedSubCategory === 'All' && stockStatusFilter === 'All' && currentPage === 1) {
            await fetchProducts(true);
        } else {
            setSearchTerm('');
            setSelectedCategory('All');
            setSelectedSubCategory('All');
            setStockStatusFilter('All');
            setCurrentPage(1);
            toast.success('Inventory synced successfully');
        }
    };

    const handleExport = async () => {
        try {
            setExporting(true);
            toast.loading('Generating Excel sheet...', { id: 'export-stock' });
            
            const response = await API.get('/products/stock/export', {
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `indiakart_stock_update_${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            toast.success('Inventory sheet downloaded!', { id: 'export-stock' });
        } catch (error) {
            console.error('Export Stock Error:', error);
            toast.error('Failed to export stock sheet', { id: 'export-stock' });
        } finally {
            setExporting(false);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = null;

        const formData = new FormData();
        formData.append('file', file);

        try {
            setImporting(true);
            toast.loading('Uploading and importing stock...', { id: 'import-stock' });

            const { data } = await API.post('/products/stock/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setImportResult(data);
            setShowResultModal(true);

            if (data.success) {
                toast.success('Stock import completed!', { id: 'import-stock' });
                fetchProducts(false);
            } else {
                toast.error('Stock import completed with errors.', { id: 'import-stock' });
            }
        } catch (error) {
            console.error('Import Stock Error:', error);
            const errMsg = error.response?.data?.message || 'Failed to upload and import stock file.';
            toast.error(errMsg, { id: 'import-stock' });
        } finally {
            setImporting(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [currentPage, itemsPerPage, selectedCategory, selectedSubCategory, stockStatusFilter, searchTerm]);

    useEffect(() => {
        fetchCategories();
        fetchSubCategories();
    }, [fetchCategories, fetchSubCategories]);

    const handleStockChange = (id, value) => {
        setEditingStock(prev => ({ ...prev, [id]: value }));
    };

    const normalizeSearchValue = (value = '') => String(value).toLowerCase().replace(/\s+/g, '');

    const updateStock = async (product, isSku = false, skuIndex = null) => {
        try {
            const editKey = isSku ? `${product.id}-${skuIndex}` : product.id;
            const newValue = editingStock[editKey];

            if (newValue === undefined || newValue === "") {
                toast.error('Please enter a valid stock number');
                return;
            }

            const payload = {};
            if (isSku) {
                const updatedSkus = [...product.skus];
                updatedSkus[skuIndex] = { ...updatedSkus[skuIndex], stock: Number(newValue) };
                payload.skus = updatedSkus;
            } else {
                payload.stock = Number(newValue);
            }

            toast.loading('Updating stock...', { id: 'update-stock' });
            await API.put(`/products/${product.id}/stock`, payload);
            toast.success('Stock updated successfully!', { id: 'update-stock' });

            setProducts(prev => {
                const nextProducts = prev.map(p => {
                    if (p.id === product.id) {
                        if (isSku) {
                            const derivedStock = payload.skus.reduce((sum, sku) => sum + (Number(sku.stock) || 0), 0);
                            return { ...p, skus: payload.skus, stock: derivedStock };
                        }
                        return { ...p, stock: payload.stock };
                    }
                    return p;
                });
                return nextProducts;
            });

            const newEditing = { ...editingStock };
            delete newEditing[editKey];
            setEditingStock(newEditing);

        } catch (error) {
            console.error('Update stock error:', error);
            toast.error(error.response?.data?.message || 'Failed to update stock', { id: 'update-stock' });
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

    const handleStockStatusChange = (e) => {
        setStockStatusFilter(e.target.value);
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
        setStockStatusFilter('All');
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
                        <MdInventory className="text-primary-600" /> Stock Management
                    </h1>
                    <p className="text-sm text-gray-500 font-medium">Update inventory levels for products and variants</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all font-bold text-sm shadow-sm"
                    >
                        <MdRefresh size={20} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    
                    <button
                        type="button"
                        onClick={handleExport}
                        disabled={exporting || loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-600 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all font-bold text-sm border border-primary-100 shadow-sm"
                    >
                        <MdFileDownload size={20} /> Export Excel
                    </button>

                    <label className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all font-bold text-sm border border-emerald-100 shadow-sm cursor-pointer animate-none">
                        <MdFileUpload size={20} />
                        <span>Import Excel</span>
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleImport}
                            disabled={importing || loading}
                        />
                    </label>
                </div>
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

                    <div className="flex flex-col gap-1 min-w-[140px] flex-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Stock Status</label>
                        <select
                            value={stockStatusFilter}
                            onChange={handleStockStatusChange}
                            className="px-3 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all text-sm font-semibold text-gray-700 cursor-pointer animate-none"
                        >
                            <option value="All">All Levels</option>
                            <option value="In Stock">In Stock (&gt; 5)</option>
                            <option value="Low Stock">Low Stock (≤ 5)</option>
                            <option value="Out of Stock">Out of Stock</option>
                        </select>
                    </div>

                    {(searchTerm || selectedCategory !== 'All' || selectedSubCategory !== 'All' || stockStatusFilter !== 'All') && (
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

            {/* Product List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[300px] flex flex-col justify-between">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <AdminTableHead>
                            <AdminTableHeaderRow>
                                <AdminTableHeaderCell compact>Product Info</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact>Category</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-center">Variants</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-center">Remaining Stock</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-right">Actions</AdminTableHeaderCell>
                            </AdminTableHeaderRow>
                        </AdminTableHead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <Loader message="Fetching inventory..." />
                                    </td>
                                </tr>
                            ) : (
                                products.map(product => (
                                    <React.Fragment key={product.id}>
                                        <tr className={`hover:bg-primary-50/10 transition-colors group ${expandedProduct === product.id ? 'bg-primary-50/30' : ''}`}>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                                                        <img src={product.image} className="w-full h-full object-contain p-1" alt="" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-sm font-black text-gray-800 truncate max-w-[220px]">{product.name}</h4>
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
                                                {product.skus && product.skus.length > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 text-[10px] font-black uppercase tracking-[0.14em] hover:bg-primary-100 transition-all border border-primary-100 shadow-sm"
                                                    >
                                                        {product.skus.length} variants
                                                        {expandedProduct === product.id ? <MdExpandLess /> : <MdExpandMore />}
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-black text-gray-300 uppercase italic tracking-widest">No Variants</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center justify-center gap-2">
                                                    <input
                                                        type="number"
                                                        disabled={product.skus && product.skus.length > 0}
                                                        className={`w-16 px-2 py-1.5 text-center rounded-lg border-2 font-black text-sm transition-all outline-none ${product.skus && product.skus.length > 0
                                                                ? 'bg-gray-100 border-transparent text-gray-400 cursor-not-allowed'
                                                                : 'bg-white border-primary-50 focus:border-primary-500 text-gray-900 group-hover:shadow-lg'
                                                            }`}
                                                        value={
                                                            editingStock[product.id] ??
                                                            (product.skus && product.skus.length > 0
                                                                ? product.skus.reduce((acc, s) => acc + (Number(s.stock) || 0), 0)
                                                                : product.stock)
                                                        }
                                                        onChange={(e) => handleStockChange(product.id, e.target.value)}
                                                    />
                                                    {product.stock <= 5 && !product.skus?.length && (
                                                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                {(!product.skus || product.skus.length === 0) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => updateStock(product)}
                                                        disabled={editingStock[product.id] === undefined}
                                                        className={`p-2 rounded-lg transition-all shadow-sm border ${editingStock[product.id] !== undefined
                                                                ? 'bg-primary-600 text-white border-primary-700 hover:scale-105 active:scale-95'
                                                                : 'bg-gray-50 text-gray-300 border-transparent cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <MdSave size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Variant Rows */}
                                        {expandedProduct === product.id && product.skus?.map((sku, idx) => (
                                            <tr key={`${product.id}-${idx}`} className="bg-gray-50/80 animate-in slide-in-from-top-2 duration-300 border-l-4 border-primary-500">
                                                <td className="pl-14 pr-4 py-3" colSpan={2}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(sku.combination).map(([key, value]) => (
                                                                <div key={key} className="flex flex-col">
                                                                    <span className="text-[10px] font-bold text-gray-400 leading-none mb-1">{key}</span>
                                                                    <span className="text-[11px] font-black text-gray-700 bg-white px-2 py-0.5 rounded border border-gray-100">{value}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td></td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <input
                                                            type="number"
                                                            className="w-16 px-2 py-1.5 text-center rounded-lg border-2 bg-white border-primary-100 focus:border-primary-500 text-gray-900 font-black text-sm transition-all outline-none"
                                                            value={editingStock[`${product.id}-${idx}`] ?? sku.stock}
                                                            onChange={(e) => handleStockChange(`${product.id}-${idx}`, e.target.value)}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateStock(product, true, idx)}
                                                        disabled={editingStock[`${product.id}-${idx}`] === undefined}
                                                        className={`p-2 rounded-lg transition-all shadow-sm border ${editingStock[`${product.id}-${idx}`] !== undefined
                                                                ? 'bg-primary-600 text-white border-primary-700 hover:scale-105 active:scale-95'
                                                                : 'bg-gray-50 text-gray-300 border-transparent cursor-not-allowed'
                                                            }`}
                                                    >
                                                        <MdSave size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))
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

            {/* Result Report Modal */}
            {showResultModal && importResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <MdInventory className="text-primary-600" /> Stock Import Report
                            </h3>
                            <button
                                onClick={() => setShowResultModal(false)}
                                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <MdClose size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider animate-none">Processed Rows</p>
                                    <p className="text-2xl font-black text-gray-800 mt-1">{importResult.summary?.totalRowsProcessed || 0}</p>
                                </div>
                                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 text-center">
                                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider animate-none">Updated Products</p>
                                    <p className="text-2xl font-black text-emerald-700 mt-1">{importResult.summary?.updatedProductsCount || 0}</p>
                                </div>
                                <div className={`p-4 rounded-xl text-center border ${
                                    (importResult.summary?.errorsCount || 0) > 0
                                        ? 'bg-red-50 border-red-100'
                                        : 'bg-gray-50 border-gray-100'
                                }`}>
                                    <p className={`text-xs font-bold uppercase tracking-wider animate-none ${
                                        (importResult.summary?.errorsCount || 0) > 0 ? 'text-red-500' : 'text-gray-400'
                                    }`}>Errors / Warnings</p>
                                    <p className={`text-2xl font-black mt-1 ${
                                        (importResult.summary?.errorsCount || 0) > 0 ? 'text-red-600' : 'text-gray-800'
                                    }`}>{importResult.summary?.errorsCount || 0}</p>
                                </div>
                            </div>

                            {/* Success Banner */}
                            {importResult.summary?.errorsCount === 0 && (
                                <div className="flex flex-col items-center justify-center py-6 px-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-center space-y-2">
                                    <MdCheckCircle className="text-emerald-500 animate-bounce" size={48} />
                                    <h4 className="text-base font-black text-emerald-800">All Updates Applied Cleanly!</h4>
                                    <p className="text-sm text-emerald-600 font-medium max-w-md">
                                        The spreadsheet was successfully validated and processed. All changes are now live in the database.
                                    </p>
                                </div>
                            )}

                            {/* Warnings/Errors section */}
                            {importResult.summary?.errorsCount > 0 && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-amber-600">
                                        <MdWarning size={20} />
                                        <h4 className="text-sm font-black uppercase tracking-wider">Validation Warnings & Errors</h4>
                                    </div>
                                    <p className="text-xs font-medium text-gray-500">
                                        Some rows could not be updated. Please correct these issues in your spreadsheet and upload again.
                                    </p>
                                    <div className="max-h-60 overflow-y-auto border border-red-100 bg-red-50/20 rounded-xl divide-y divide-red-100/50">
                                        {importResult.summary.errors.map((err, idx) => (
                                            <div key={idx} className="p-3 text-xs font-semibold text-red-700 flex items-start gap-2">
                                                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5"></span>
                                                <span>{err}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setShowResultModal(false)}
                                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                            >
                                Close Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockManagement;
