import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MdBusinessCenter, MdSearch, MdSync, MdFileDownload, MdFileUpload } from 'react-icons/md';
import toast from 'react-hot-toast';
import API from '../../../../services/api';
import useCategoryStore from '../../store/categoryStore';
import { normalizeSearchValue } from '../../utils/search';

const Toggle = ({ checked, disabled = false, onChange }) => (
    <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
            checked ? 'bg-primary-600' : 'bg-gray-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
        <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                checked ? 'translate-x-8' : 'translate-x-1'
            }`}
        />
    </button>
);

const B2BManager = () => {
    const { categories, fetchCategories, isLoading: categoriesLoading } = useCategoryStore();
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [categorySaving, setCategorySaving] = useState(false);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [productSavingId, setProductSavingId] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef(null);

    const topLevelCategories = useMemo(
        () => (Array.isArray(categories) ? categories.filter((category) => category?.name) : []),
        [categories]
    );

    const selectedCategory = useMemo(
        () => topLevelCategories.find((category) => String(category.id) === String(selectedCategoryId)) || null,
        [topLevelCategories, selectedCategoryId]
    );

    const fetchCategoryProducts = async (categoryName) => {
        if (!categoryName) {
            setProducts([]);
            return;
        }

        setProductsLoading(true);
        try {
            const { data } = await API.get('/products', {
                params: {
                    all: 'true',
                    category: categoryName,
                    lite: 'true'
                }
            });
            setProducts(Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []));
        } catch (error) {
            console.error(error);
            toast.error('Failed to load B2B products');
            setProducts([]);
        } finally {
            setProductsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        if (!selectedCategoryId && topLevelCategories.length > 0) {
            setSelectedCategoryId(String(topLevelCategories[0].id));
        }
    }, [topLevelCategories, selectedCategoryId]);

    useEffect(() => {
        if (selectedCategory?.name) {
            fetchCategoryProducts(selectedCategory.name);
        }
    }, [selectedCategory?.name]);

    const filteredProducts = useMemo(() => {
        const term = normalizeSearchValue(searchTerm);
        if (!term) return products;

        return products.filter((product) =>
            [product.name, product.brand]
                .filter(Boolean)
                .some((value) => normalizeSearchValue(value).includes(term))
        );
    }, [products, searchTerm]);
    const enabledProductCount = useMemo(
        () => products.filter((product) => Boolean(product?.b2bEnabled)).length,
        [products]
    );

    const handleCategoryToggle = async () => {
        if (!selectedCategory) return;

        setCategorySaving(true);
        const nextValue = !selectedCategory.b2bEnabled;
        try {
            await API.put(`/categories/${selectedCategory.id}`, { b2bEnabled: nextValue });
            toast.success(`B2B ${nextValue ? 'enabled' : 'disabled'} for ${selectedCategory.name}`);
            await fetchCategories();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update category B2B status');
        } finally {
            setCategorySaving(false);
        }
    };

    const handleProductToggle = async (productId, nextValue) => {
        setProductSavingId(productId);
        try {
            await API.put(`/products/${productId}`, { b2bEnabled: nextValue });
            setProducts((currentProducts) =>
                currentProducts.map((product) =>
                    product.id === productId ? { ...product, b2bEnabled: nextValue } : product
                )
            );
            toast.success(`Product ${nextValue ? 'added to' : 'removed from'} B2B`);
        } catch (error) {
            console.error(error);
            toast.error('Failed to update product B2B status');
        } finally {
            setProductSavingId(null);
        }
    };

    const handleExportB2B = async () => {
        setIsExporting(true);
        try {
            const { data } = await API.get('/products/b2b/export', { responseType: 'blob', timeout: 0 });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = `b2b_access_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('B2B sheet downloaded');
        } catch {
            toast.error('Failed to export B2B sheet');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportB2B = async (event) => {
        const file = event.target.files?.[0];
        // Reset immediately so re-picking the same file still fires onChange.
        event.target.value = '';
        if (!file) return;

        setIsImporting(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const { data } = await API.post('/products/b2b/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 0
            });

            toast.success(data?.message || 'B2B sheet imported');
            if (data?.errorCount) {
                toast.error(`${data.errorCount} row${data.errorCount === 1 ? '' : 's'} skipped. First: ${data.errors?.[0] || ''}`);
            }
            if (selectedCategory?.name) fetchCategoryProducts(selectedCategory.name);
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to import B2B sheet');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">B2B Management</h1>
                    <p className="text-sm text-gray-500">Turn B2B on for a category as a gate, then choose the exact products that should show B2B on checkout.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportB2B}
                        disabled={isExporting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                    >
                        <MdFileDownload size={18} />
                        {isExporting ? 'Exporting...' : 'Export Excel'}
                    </button>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300"
                    >
                        <MdFileUpload size={18} />
                        {isImporting ? 'Importing...' : 'Import Excel'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleImportB2B}
                    />
                    <button
                        type="button"
                        onClick={() => selectedCategory?.name && fetchCategoryProducts(selectedCategory.name)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        <MdSync size={18} />
                        Refresh Products
                    </button>
                </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_1fr]">
                    <div>
                        <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">
                            Category
                        </label>
                        <select
                            value={selectedCategoryId}
                            onChange={(event) => setSelectedCategoryId(event.target.value)}
                            disabled={categoriesLoading}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-primary-500 focus:bg-white"
                        >
                            {topLevelCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-start gap-3">
                                <div className="rounded-2xl bg-primary-600 p-3 text-white">
                                    <MdBusinessCenter size={22} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary-600">Category B2B Gate</p>
                                    <h2 className="text-lg font-bold text-gray-900">{selectedCategory?.name || 'Select a category'}</h2>
                                    <p className="text-sm text-gray-600">
                                        This does not enable every product. It only allows checkout B2B for products below that are individually turned on.
                                    </p>
                                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-primary-700">
                                        {enabledProductCount} selected B2B product{enabledProductCount === 1 ? '' : 's'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className={`text-sm font-bold ${selectedCategory?.b2bEnabled ? 'text-primary-700' : 'text-gray-500'}`}>
                                    {selectedCategory?.b2bEnabled ? 'Enabled' : 'Disabled'}
                                </span>
                                <Toggle
                                    checked={Boolean(selectedCategory?.b2bEnabled)}
                                    disabled={!selectedCategory || categorySaving}
                                    onChange={handleCategoryToggle}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Category Products</h2>
                        <p className="text-sm text-gray-500">{filteredProducts.length} products in the current view. Only toggled products will show B2B on checkout.</p>
                    </div>
                    <div className="relative w-full md:w-80">
                        <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search by product or brand"
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm font-medium text-gray-900 outline-none focus:border-primary-500 focus:bg-white"
                        />
                    </div>
                </div>

                {productsLoading ? (
                    <div className="py-16 text-center text-sm font-semibold text-gray-500">Loading products...</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="py-16 text-center text-sm font-semibold text-gray-500">No products found for this category.</div>
                ) : (
                    <div className="space-y-3">
                        {filteredProducts.map((product) => (
                            <div
                                key={product.id}
                                className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 md:flex-row md:items-center md:justify-between"
                            >
                                <div className="flex min-w-0 items-center gap-4">
                                    <div className="h-16 w-16 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                                        {product.image ? (
                                            <img src={product.image} alt={product.name} className="h-full w-full object-contain p-1" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-300">
                                                No Image
                                            </div>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-bold text-gray-900">{product.name}</h3>
                                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                                            {product.brand || 'No Brand'}
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-gray-600">
                                            Rs. {Number(product.price || 0).toLocaleString()} • Stock {Number(product.stock || 0)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-4 md:min-w-[190px] md:justify-end">
                                    <span className={`text-sm font-bold ${product.b2bEnabled ? 'text-primary-700' : 'text-gray-500'}`}>
                                        {product.b2bEnabled ? 'B2B On' : 'B2B Off'}
                                    </span>
                                    <Toggle
                                        checked={Boolean(product.b2bEnabled)}
                                        disabled={productSavingId === product.id}
                                        onChange={() => handleProductToggle(product.id, !product.b2bEnabled)}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default B2BManager;
