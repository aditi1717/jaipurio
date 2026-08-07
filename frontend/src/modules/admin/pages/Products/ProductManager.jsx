import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MdAdd, MdSearch, MdEdit, MdDelete, MdFilterList, MdImage, MdVisibility, MdChevronLeft, MdChevronRight, MdClose, MdFileDownload } from 'react-icons/md';
import useProductStore from '../../store/productStore';
import Pagination from '../../../../components/Pagination';
import API from '../../../../services/api'; import toast from 'react-hot-toast';
import useCategoryStore from '../../store/categoryStore';
import { confirmToast } from '../../../../utils/toastUtils.jsx';
import { clearAdminListCache, getAdminListCache, setAdminListCache } from '../../utils/adminListCache';

const PRODUCT_PICKER_RESULT_KEY = 'category-page-builder-product-picker-result-v1';
const PRODUCT_LIST_CACHE_PREFIX = 'admin-products:list:';

const getCategoryLabel = (product) => {
    const rawCategory = product?.category;
    if (!rawCategory) return 'Uncategorized';
    if (typeof rawCategory === 'string') return rawCategory;
    return rawCategory.name || 'Uncategorized';
};

const getSubCategoryLabel = (product) => {
    const multi = product?.subCategories;
    if (Array.isArray(multi) && multi.length > 0) {
        const names = multi
            .map((item) => (typeof item === 'string' ? item : item?.name))
            .filter(Boolean);
        if (names.length > 0) return names.join(', ');
    }

    const single = product?.subCategory;
    if (!single) return '';
    if (typeof single === 'string') return single;
    return single.name || '';
};

const getProductId = (product) => String(product?.id || product?._id || '');
const parseSelectedProductIds = (value = '') => (
    String(value || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
);

const buildProductListCacheKey = ({ currentPage, itemsPerPage, searchTerm, filterCategory }) => (
    `${PRODUCT_LIST_CACHE_PREFIX}${JSON.stringify({
        page: currentPage,
        limit: itemsPerPage,
        search: String(searchTerm || '').trim(),
        category: String(filterCategory || 'All').trim()
    })}`
);

const ProductManager = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { deleteProduct } = useProductStore();
    const { categories, fetchCategories } = useCategoryStore();
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportScope, setExportScope] = useState('all');
    const [exportCategory, setExportCategory] = useState('');
    const [exportSubCategory, setExportSubCategory] = useState('');
    const [exportSubOptions, setExportSubOptions] = useState([]);
    const [isExporting, setIsExporting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [selectedProduct, setSelectedProduct] = useState(null);

    // Server-side Pagination State
    const itemsPerPage = 20;
    const initialCacheKey = buildProductListCacheKey({
        currentPage: 1,
        itemsPerPage,
        searchTerm: '',
        filterCategory: 'All'
    });
    const initialCachedList = getAdminListCache(initialCacheKey);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(() => initialCachedList?.totalPages || 1);
    const [totalProducts, setTotalProducts] = useState(() => initialCachedList?.totalProducts || 0);

    const [localProducts, setLocalProducts] = useState(() => initialCachedList?.products || []);
    const pickerMode = searchParams.get('picker') === 'category-builder';
    const pickerReturnTo = searchParams.get('returnTo') || '/admin/categories/page-builder';
    const pickerCategoryId = searchParams.get('categoryId') || '';
    const pickerSectionId = searchParams.get('sectionId') || '';
    const preselectedParam = searchParams.get('selected') || '';
    const [pickerSelectedIds, setPickerSelectedIds] = useState(() => (
        pickerMode ? parseSelectedProductIds(preselectedParam) : []
    ));

    useEffect(() => {
        let active = true;
        const cacheKey = buildProductListCacheKey({
            currentPage,
            itemsPerPage,
            searchTerm,
            filterCategory
        });
        const cachedList = getAdminListCache(cacheKey);

        if (cachedList) {
            setLocalProducts(cachedList.products);
            setTotalPages(cachedList.totalPages);
            setTotalProducts(cachedList.totalProducts);
        }

        const fetchPaginatedProducts = async () => {
            try {
                const params = {
                    pageNumber: currentPage,
                    limit: itemsPerPage,
                    all: 'true',
                    lite: 'true'
                };

                if (filterCategory !== 'All') {
                    params.category = filterCategory;
                }
                const searchText = searchTerm.trim();
                if (searchText) {
                    params.search = searchText;
                }

                const { data } = await API.get('/products', { params });

                if (!active) return;
                let nextProducts = [];
                let nextTotalPages = 1;
                let nextTotalProducts = 0;

                if (data.products) {
                    nextProducts = data.products;
                    nextTotalPages = data.pages;
                    nextTotalProducts = data.total;
                } else {
                    // Fallback if backend returns array (backward compat)
                    nextProducts = Array.isArray(data) ? data : [];
                    nextTotalPages = 1;
                    nextTotalProducts = Array.isArray(data) ? data.length : 0;
                }

                setAdminListCache(cacheKey, {
                    products: nextProducts,
                    totalPages: nextTotalPages,
                    totalProducts: nextTotalProducts
                });

                setLocalProducts(nextProducts);
                setTotalPages(nextTotalPages);
                setTotalProducts(nextTotalProducts);
            } catch (error) {
                console.error(error);
                if (active) toast.error('Failed to fetch products');
            }
        };

        const timer = setTimeout(fetchPaginatedProducts, cachedList ? 0 : 250);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [currentPage, filterCategory, searchTerm]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    // Update handleDelete to refresh list
    const handleDelete = async (id) => {
        confirmToast({
            message: 'Are you sure you want to delete this product?',
            type: 'danger',
            icon: 'delete_forever',
            confirmText: 'Delete Product',
            onConfirm: async () => {
                await deleteProduct(id); // Store action
                clearAdminListCache(PRODUCT_LIST_CACHE_PREFIX);
                // Refresh local list
                const searchText = searchTerm.trim();
                const { data } = await API.get('/products', {
                    params: {
                        pageNumber: currentPage,
                        limit: itemsPerPage,
                        all: 'true',
                        lite: 'true',
                        category: filterCategory !== 'All' ? filterCategory : undefined,
                        search: searchText || undefined
                    }
                });
                if (data.products) {
                    setLocalProducts(data.products);
                    setTotalPages(data.pages);
                    setTotalProducts(data.total);
                    setAdminListCache(buildProductListCacheKey({
                        currentPage,
                        itemsPerPage,
                        searchTerm,
                        filterCategory
                    }), {
                        products: data.products,
                        totalPages: data.pages,
                        totalProducts: data.total
                    });
                }
            }
        });
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const togglePickerSelection = (productId, checked) => {
        const normalizedId = String(productId);
        setPickerSelectedIds((prev) => {
            const set = new Set(prev.map((id) => String(id)));
            if (checked) set.add(normalizedId);
            else set.delete(normalizedId);
            return Array.from(set);
        });
    };

    const handlePickerSave = async () => {
        try {
            const selectedSet = new Set(pickerSelectedIds.map((id) => String(id)));
            let selectedProducts = [];

            if (selectedSet.size > 0) {
                const { data } = await API.get('/products', {
                    params: {
                        all: 'true',
                        lite: 'true',
                        ids: pickerSelectedIds.join(',')
                    }
                });
                const allProducts = Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []);
                selectedProducts = allProducts
                    .filter((product) => selectedSet.has(getProductId(product)))
                    .map((product) => ({
                        id: getProductId(product),
                        name: product?.name || '',
                        image: product?.image || '',
                        subtitle: product?.subtitle || ''
                    }));
            }

            localStorage.setItem(PRODUCT_PICKER_RESULT_KEY, JSON.stringify({
                target: 'category-page-builder',
                categoryId: pickerCategoryId,
                sectionId: pickerSectionId,
                productIds: pickerSelectedIds,
                products: selectedProducts
            }));
            navigate(pickerReturnTo);
        } catch {
            toast.error('Failed to save selected products');
        }
    };


    // Subcategories are fetched on demand so the dialog only lists ones that
    // actually belong to the chosen category.
    const loadExportSubCategories = async (categoryId) => {
        setExportSubCategory('');
        setExportSubOptions([]);
        if (!categoryId) return;
        try {
            const { data } = await API.get(`/subcategories/category/${categoryId}`);
            const list = Array.isArray(data) ? data : (data?.subCategories || []);
            setExportSubOptions(list);
        } catch {
            toast.error('Could not load subcategories');
        }
    };

    const handleExportProducts = async () => {
        if (exportScope === 'category' && !exportCategory) {
            toast.error('Choose a category first');
            return;
        }
        if (exportScope === 'subcategory' && !exportSubCategory) {
            toast.error('Choose a subcategory first');
            return;
        }

        setIsExporting(true);
        try {
            const params = {};
            const selectedCategory = categories.find((c) => String(c._id || c.id) === String(exportCategory));

            if (exportScope === 'category') {
                params.category = selectedCategory?.name || '';
            } else if (exportScope === 'subcategory') {
                if (selectedCategory?.name) params.category = selectedCategory.name;
                params.subcategory = exportSubCategory;
            }

            const { data } = await API.get('/products/stock/export', {
                params,
                responseType: 'blob',
                timeout: 0
            });

            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            const suffix = exportScope === 'all'
                ? 'all'
                : (exportScope === 'subcategory' ? exportSubCategory : selectedCategory?.name || 'category');
            link.download = `products_${String(suffix).replace(/\s+/g, '-').toLowerCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setShowExportModal(false);
            toast.success('Export downloaded');
        } catch (error) {
            // The server answers with JSON on failure even though we asked for
            // a blob, so read it back before showing a generic message.
            let message = '';
            const payload = error?.response?.data;
            if (payload instanceof Blob) {
                try { message = JSON.parse(await payload.text())?.message || ''; } catch { message = ''; }
            }
            toast.error(message || 'Failed to export products');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-2 md:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                <div>
                    <h1 className="text-lg md:text-2xl font-bold text-gray-800">{pickerMode ? 'Select Products' : 'Product Management'}</h1>
                    <p className="text-gray-500 text-xs md:text-sm">
                        {pickerMode ? `Select products and save (${pickerSelectedIds.length} selected)` : `Manage inventory, prices, and product details (${totalProducts} total)`}
                    </p>
                </div>
                {pickerMode ? (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => navigate(pickerReturnTo)}
                            className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-semibold hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handlePickerSave}
                            className="flex-1 md:flex-none px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                        >
                            Save Selected
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                            onClick={() => setShowExportModal(true)}
                            disabled={isExporting}
                            className="flex items-center justify-center gap-1 md:gap-2 bg-emerald-600 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300 transition shadow-sm font-medium flex-1 md:flex-none text-xs md:text-base"
                        >
                            <MdFileDownload size={20} className="w-4 h-4 md:w-5 md:h-5" />
                            {isExporting ? 'Exporting...' : 'Export'}
                        </button>
                        <button
                            onClick={() => navigate('/admin/products/new')}
                            className="flex items-center justify-center gap-1 md:gap-2 bg-blue-600 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg hover:bg-blue-700 transition shadow-sm font-medium flex-1 md:flex-none text-xs md:text-base"
                        >
                            <MdAdd size={20} className="w-4 h-4 md:w-5 md:h-5" /> Add Product
                        </button>
                    </div>
                )}
            </div>

            {/* Filters */}
            {/* Filters */}
            <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products by name or brand..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl md:rounded-2xl focus:bg-white focus:border-blue-500 outline-none transition-all text-sm text-gray-900 placeholder:text-gray-900 font-bold"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
                    <MdFilterList className="text-gray-400" size={20} />
                    <select
                        className="px-4 py-2 md:px-6 md:py-3 bg-gray-50 border border-transparent rounded-xl md:rounded-2xl outline-none focus:bg-white focus:border-blue-500 text-sm font-black text-gray-900 min-w-[120px] md:min-w-[150px]"
                        value={filterCategory}
                        onChange={(e) => {
                            setFilterCategory(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                        <option value="All">All Categories</option>
                        {categories.map(cat => (
                            <option key={cat.id || cat._id || cat} value={cat.name || cat}>{cat.name || cat}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Product Table */}
            {localProducts.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-xl border border-dashed border-gray-300">
                    <p className="text-gray-500">No products found matching your criteria.</p>
                </div>
            ) : (
                <div className="relative -mx-4 md:mx-0">
                    <div className="bg-white md:rounded-2xl border-y md:border border-gray-200 shadow-sm">
                        <div className="overflow-x-auto overflow-y-visible" style={{ WebkitOverflowScrolling: 'touch', maxWidth: '100vw' }}>
                            <table className="w-full min-w-max text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-900 border-b border-slate-800">
                                        {pickerMode && <th className="whitespace-nowrap px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-center">Select</th>}
                                        <th className="whitespace-nowrap md:whitespace-normal px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Product Details</th>
                                        <th className="whitespace-nowrap md:whitespace-normal px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-center">Category</th>
                                        <th className="whitespace-nowrap md:whitespace-normal px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-center">Subcategory</th>
                                        <th className="whitespace-nowrap md:whitespace-normal px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-center">Brand</th>
                                        <th className="whitespace-nowrap md:whitespace-normal px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-center">Stock Status</th>
                                        <th className="whitespace-nowrap md:whitespace-normal px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-center">Max Qty</th>
                                        <th className="whitespace-nowrap md:whitespace-normal px-2 py-2 md:px-4 md:py-3 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {localProducts.map(product => (
                                        <tr key={getProductId(product)} className="hover:bg-blue-50/10 transition-colors group">
                                            {pickerMode && (
                                                <td className="whitespace-nowrap px-2 py-1.5 md:px-4 md:py-2.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={pickerSelectedIds.includes(getProductId(product))}
                                                        onChange={(e) => togglePickerSelection(getProductId(product), e.target.checked)}
                                                        className="h-4 w-4 accent-blue-600"
                                                    />
                                                </td>
                                            )}
                                            <td className="whitespace-nowrap md:whitespace-normal px-2 py-1.5 md:px-4 md:py-2.5">
                                                <div className="flex items-center gap-2 md:gap-3">
                                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                                                        {product.image ? (
                                                            <img src={product.image} className="w-full h-full object-contain p-1" alt="" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-200">
                                                                <MdImage size={24} className="w-4 h-4 md:w-6 md:h-6" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest truncate">{product.brand || 'No Brand'}</p>
                                                        <h3 className="text-xs font-bold text-gray-800 truncate max-w-[150px] md:max-w-[200px]" title={product.name}>{product.name}</h3>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap md:whitespace-normal px-2 py-1.5 md:px-4 md:py-2.5 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="inline-block px-2.5 py-1 rounded-full bg-blue-50 text-[10px] font-black text-blue-600 uppercase">
                                                        {getCategoryLabel(product)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap md:whitespace-normal px-2 py-1.5 md:px-4 md:py-2.5 text-center">
                                                {getSubCategoryLabel(product) ? (
                                                    <span className="inline-block px-2.5 py-1 rounded-full bg-gray-100 text-[9px] font-bold text-gray-500 uppercase">
                                                        {getSubCategoryLabel(product)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">N/A</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap md:whitespace-normal px-2 py-1.5 md:px-4 md:py-2.5 text-center">
                                                {String(product.subcategoryBrand || '').trim() ? (
                                                    <span className="inline-block px-2.5 py-1 rounded-full bg-blue-50 text-[9px] font-bold text-blue-600 uppercase">
                                                        {product.subcategoryBrand}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">N/A</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap md:whitespace-normal px-2 py-1.5 md:px-4 md:py-2.5 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-[11px] font-black uppercase tracking-widest ${(product.stock || 0) <= 5 ? 'text-amber-500 animate-pulse' : 'text-blue-600'}`}>
                                                        {product.stock || 0} Units
                                                    </span>
                                                    <div className="w-16 h-1 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ${(product.stock || 0) <= 5 ? 'bg-amber-500' : 'bg-blue-600'}`}
                                                            style={{ width: `${Math.min(100, (product.stock || 0) * 2)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap md:whitespace-normal px-2 py-1.5 md:px-4 md:py-2.5 text-center">
                                                <span className="inline-block px-2.5 py-1 rounded-full bg-amber-50 text-[10px] font-black text-amber-700 uppercase">
                                                    {Number(product.maxOrderQuantity) > 0 ? product.maxOrderQuantity : 1}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap md:whitespace-normal px-2 py-1.5 md:px-4 md:py-2.5 text-right">
                                                {pickerMode ? (
                                                    <span className="text-[11px] font-semibold text-gray-500">Select from checkbox</span>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1 md:gap-2">
                                                        <button
                                                            onClick={() => setSelectedProduct(product)}
                                                            className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center bg-gray-50 hover:bg-green-600 text-gray-400 hover:text-white rounded-lg md:rounded-xl transition-all shadow-sm border border-transparent hover:border-green-700"
                                                            title="Quick View"
                                                        >
                                                            <MdVisibility size={14} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
                                                        <button
                                                            onClick={() => navigate(`/admin/products/edit/${getProductId(product)}`)}
                                                            className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center bg-gray-50 hover:bg-blue-600 text-gray-400 hover:text-white rounded-lg md:rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-700"
                                                            title="Edit Product"
                                                        >
                                                            <MdEdit size={14} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(getProductId(product))}
                                                            className="w-7 h-7 md:w-9 md:h-9 flex items-center justify-center bg-gray-50 hover:bg-red-600 text-gray-400 hover:text-white rounded-lg md:rounded-xl transition-all shadow-sm border border-transparent hover:border-red-700"
                                                            title="Delete Product"
                                                        >
                                                            <MdDelete size={14} className="md:w-[18px] md:h-[18px]" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination UI */}
                    {totalPages > 1 && (
                        <Pagination
                            page={currentPage}
                            pages={totalPages}
                            changePage={handlePageChange}
                        />
                    )}
                </div>
            )}

            {/* Quick View Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-2xl rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="relative p-4 md:p-8">
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="absolute top-3 right-3 md:top-6 md:right-6 p-1 md:p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                            >
                                <MdClose size={20} className="md:w-6 md:h-6" />
                            </button>

                            <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                                <div className="w-full h-48 md:w-64 md:h-64 bg-gray-50 rounded-2xl border border-gray-100 p-4 flex-shrink-0">
                                    <img src={selectedProduct.image} className="w-full h-full object-contain" alt="" />
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{selectedProduct.brand}</p>
                                        <h3 className="text-2xl font-black text-gray-900 leading-tight">{selectedProduct.name}</h3>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="text-2xl font-black text-gray-900">₹{selectedProduct.price.toLocaleString()}</div>
                                        {selectedProduct.originalPrice > selectedProduct.price && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-400 line-through">₹{selectedProduct.originalPrice.toLocaleString()}</span>
                                                <span className="text-sm font-bold text-green-500">{selectedProduct.discount}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <p className="text-xs font-bold text-gray-800">Category: {getCategoryLabel(selectedProduct)}</p>
                                            <p className="text-[11px] font-semibold text-gray-500 mt-1">
                                                Subcategory: {getSubCategoryLabel(selectedProduct) || 'N/A'}
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Stock Level</p>
                                            <p className={`text-xs font-bold ${selectedProduct.stock <= 5 ? 'text-amber-500' : 'text-gray-800'}`}>{selectedProduct.stock || 0} Units</p>
                                            <p className="text-[11px] font-semibold text-gray-500 mt-1">
                                                Max Qty: {Number(selectedProduct.maxOrderQuantity) > 0 ? selectedProduct.maxOrderQuantity : 1}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            onClick={() => {
                                                navigate(`/product/${selectedProduct.id}`);
                                                setSelectedProduct(null);
                                            }}
                                            className="flex-1 py-3 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                                        >
                                            View on Website
                                        </button>
                                        <button
                                            onClick={() => {
                                                navigate(`/admin/products/edit/${selectedProduct.id}`);
                                                setSelectedProduct(null);
                                            }}
                                            className="flex-1 py-3 bg-gray-100 text-gray-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-gray-200 transition"
                                        >
                                            Edit Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl bg-white border border-gray-100 shadow-2xl p-6 space-y-4">
                        <div>
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wide">Export Products</h2>
                            <p className="text-xs font-bold text-gray-500 mt-1">Choose what to include in the spreadsheet.</p>
                        </div>

                        <div className="space-y-2">
                            {[
                                { value: 'all', label: 'All products', hint: 'Everything in the catalogue' },
                                { value: 'category', label: 'By category', hint: 'One category only' },
                                { value: 'subcategory', label: 'By subcategory', hint: 'A single subcategory' }
                            ].map((option) => (
                                <label
                                    key={option.value}
                                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                                        exportScope === option.value
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="exportScope"
                                        value={option.value}
                                        checked={exportScope === option.value}
                                        onChange={(e) => setExportScope(e.target.value)}
                                        className="mt-1"
                                    />
                                    <span>
                                        <span className="block text-sm font-black text-gray-900">{option.label}</span>
                                        <span className="block text-[11px] font-semibold text-gray-500">{option.hint}</span>
                                    </span>
                                </label>
                            ))}
                        </div>

                        {exportScope !== 'all' && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Category</label>
                                <select
                                    value={exportCategory}
                                    onChange={(e) => {
                                        setExportCategory(e.target.value);
                                        if (exportScope === 'subcategory') loadExportSubCategories(e.target.value);
                                    }}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white"
                                >
                                    <option value="">Select a category</option>
                                    {categories.map((cat) => (
                                        <option key={cat._id || cat.id} value={cat._id || cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {exportScope === 'subcategory' && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Subcategory</label>
                                <select
                                    value={exportSubCategory}
                                    onChange={(e) => setExportSubCategory(e.target.value)}
                                    disabled={!exportCategory}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white disabled:opacity-60"
                                >
                                    <option value="">
                                        {exportCategory ? 'Select a subcategory' : 'Choose a category first'}
                                    </option>
                                    {exportSubOptions.map((sub) => (
                                        <option key={sub._id || sub.id} value={sub.name}>{sub.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                disabled={isExporting}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleExportProducts}
                                disabled={isExporting}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase hover:bg-emerald-700 disabled:bg-emerald-300"
                            >
                                {isExporting ? 'Exporting...' : 'Download Excel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManager;



