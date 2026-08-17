import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MdAdd, MdClose, MdDelete, MdToggleOn, MdToggleOff, MdContentCopy, MdEdit } from 'react-icons/md';
import useCouponStore from '../../store/couponStore';
import useCategoryStore from '../../store/categoryStore';
import useSubCategoryStore from '../../store/subCategoryStore';
import useBrandStore from '../../store/brandStore';
import { confirmToast } from '../../../../utils/toastUtils.jsx';

const getInitialCouponData = () => ({
    code: '',
    title: '',
    description: '',
    type: 'percentage',
    value: '',
    minPurchase: '',
    maxDiscount: '',
    expiryDate: '',
    userSegment: 'all',
    applicableCategory: 'all',
    applicableSubCategory: 'all',
    applicableBrand: 'all'
});

const normalizeValue = (value) => String(value || '').trim().toLowerCase();

const CouponManager = () => {
    const { coupons, addCoupon, updateCoupon, deleteCoupon, toggleCouponStatus, fetchCoupons } = useCouponStore();
    const categories = useCategoryStore((state) => state.categories);
    const fetchCategories = useCategoryStore((state) => state.fetchCategories);
    const getAllCategoriesFlat = useCategoryStore((state) => state.getAllCategoriesFlat);
    const subCategories = useSubCategoryStore((state) => state.subCategories);
    const fetchSubCategories = useSubCategoryStore((state) => state.fetchSubCategories);
    const brands = useBrandStore((state) => state.brands);
    const fetchBrands = useBrandStore((state) => state.fetchBrands);

    useEffect(() => {
        fetchCoupons();
    }, [fetchCoupons]);

    useEffect(() => {
        if (!categories.length) fetchCategories();
        if (!subCategories.length) fetchSubCategories();
        if (!brands.length) fetchBrands();
    }, [brands.length, categories.length, fetchBrands, fetchCategories, fetchSubCategories, subCategories.length]);

    const [showForm, setShowForm] = useState(false);
    const [editingCouponId, setEditingCouponId] = useState(null);
    const [couponData, setCouponData] = useState(getInitialCouponData);

    const todayStr = new Date().toISOString().split('T')[0];
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const isEditing = Boolean(editingCouponId);

    const categoryOptions = useMemo(() => {
        const unique = new Map();
        getAllCategoriesFlat().forEach((category) => {
            const name = String(category?.name || '').trim();
            if (!name) return;
            unique.set(name.toLowerCase(), name);
        });
        return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
    }, [categories, getAllCategoriesFlat]);

    const subCategoryOptions = useMemo(() => {
        const selectedCategory = normalizeValue(couponData.applicableCategory);
        return (Array.isArray(subCategories) ? subCategories : [])
            .filter((subCategory) => {
                if (!selectedCategory || selectedCategory === 'all') return true;
                return normalizeValue(subCategory?.category?.name) === selectedCategory;
            })
            .map((subCategory) => String(subCategory?.name || '').trim())
            .filter(Boolean)
            .filter((name, index, all) => all.findIndex((entry) => normalizeValue(entry) === normalizeValue(name)) === index)
            .sort((a, b) => a.localeCompare(b));
    }, [couponData.applicableCategory, subCategories]);

    const brandOptions = useMemo(() => {
        const selectedCategory = normalizeValue(couponData.applicableCategory);
        const selectedSubCategory = normalizeValue(couponData.applicableSubCategory);

        return (Array.isArray(brands) ? brands : [])
            .filter((brand) => {
                const brandSubCategory = normalizeValue(brand?.subcategory?.name || brand?.subcategory);
                const brandCategory = normalizeValue(brand?.subcategory?.category?.name);

                if (selectedSubCategory && selectedSubCategory !== 'all' && brandSubCategory !== selectedSubCategory) {
                    return false;
                }
                if (selectedCategory && selectedCategory !== 'all' && brandCategory !== selectedCategory) {
                    return false;
                }
                return true;
            })
            .map((brand) => String(brand?.name || '').trim())
            .filter(Boolean)
            .filter((name, index, all) => all.findIndex((entry) => normalizeValue(entry) === normalizeValue(name)) === index)
            .sort((a, b) => a.localeCompare(b));
    }, [brands, couponData.applicableCategory, couponData.applicableSubCategory]);
    const isAllCategoriesSelected = normalizeValue(couponData.applicableCategory) === 'all';
    const isAllSubCategoriesSelected = normalizeValue(couponData.applicableSubCategory) === 'all';

    const resetForm = () => {
        setCouponData(getInitialCouponData());
        setEditingCouponId(null);
        setShowForm(false);
    };

    const openCreateForm = () => {
        setCouponData(getInitialCouponData());
        setEditingCouponId(null);
        setShowForm(true);
    };

    const handleEdit = (coupon) => {
        setCouponData({
            code: coupon.code || '',
            title: coupon.title || '',
            description: coupon.description || '',
            type: coupon.type || 'percentage',
            value: coupon.value ?? '',
            minPurchase: coupon.minPurchase ?? '',
            maxDiscount: coupon.maxDiscount ?? '',
            expiryDate: coupon.expiryDate || '',
            userSegment: coupon.userSegment || 'all',
            applicableCategory: coupon.applicableCategory || 'all',
            applicableSubCategory: coupon.applicableSubCategory || 'all',
            applicableBrand: coupon.applicableBrand || 'all'
        });
        setEditingCouponId(coupon._id);
        setShowForm(true);
    };

    const updateCouponField = (field, value) => {
        setCouponData((prev) => {
            if (field === 'applicableCategory') {
                return {
                    ...prev,
                    applicableCategory: value,
                    applicableSubCategory: 'all',
                    applicableBrand: 'all'
                };
            }

            if (field === 'applicableSubCategory') {
                return {
                    ...prev,
                    applicableSubCategory: value,
                    applicableBrand: 'all'
                };
            }

            return {
                ...prev,
                [field]: value
            };
        });
    };

    const handleCouponSubmit = async (e) => {
        e.preventDefault();
        const normalizedCode = couponData.code.trim().toUpperCase();

        if (!normalizedCode) {
            toast.error('Coupon code is required');
            return;
        }
        if (!couponData.expiryDate) {
            toast.error('Expiry date is required');
            return;
        }
        if (couponData.expiryDate <= todayStr) {
            toast.error('Expiry date must be greater than creation date');
            return;
        }

        try {
            const payload = {
                ...couponData,
                code: normalizedCode,
                value: Number(couponData.value),
                minPurchase: Number(couponData.minPurchase),
                maxDiscount: couponData.maxDiscount ? Number(couponData.maxDiscount) : 0
            };

            if (isEditing) {
                await updateCoupon(editingCouponId, payload);
            } else {
                await addCoupon(payload);
            }

            resetForm();
        } catch {
            // Store shows backend error toast.
        }
    };

    const handleDelete = (id) => {
        confirmToast({
            message: 'Are you sure you want to delete this coupon?',
            type: 'danger',
            icon: 'delete_forever',
            confirmText: 'Delete',
            onConfirm: () => deleteCoupon(id)
        });
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code);
        toast.success(`Copied: ${code}`);
    };

    const getSegmentLabel = (segment) => {
        switch (segment) {
            case 'new_user': return 'New Users Only';
            case 'existing_user': return 'Existing Users';
            default: return 'All Users';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Coupons</h1>
                    <p className="text-gray-500 text-sm">Manage discount codes</p>
                </div>
                <button
                    onClick={openCreateForm}
                    className="flex items-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition shadow-sm font-medium"
                >
                    <MdAdd size={20} /> Create Coupon
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {coupons.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                        No active coupons found. Create one to get started!
                    </div>
                ) : (
                    coupons.map((coupon) => (
                        <div key={coupon._id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative group hover:shadow-md transition">
                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${coupon.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>

                            <div className="p-5 pl-7">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div
                                            onClick={() => copyCode(coupon.code)}
                                            className="font-mono text-lg font-bold text-gray-800 tracking-wider cursor-pointer hover:text-primary-600 flex items-center gap-2 group/code"
                                            title="Click to Copy"
                                        >
                                            {coupon.code}
                                            <MdContentCopy size={14} className="opacity-0 group-hover/code:opacity-100 transition-opacity text-gray-400" />
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded border border-green-100 font-bold uppercase">
                                                {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `Rs ${coupon.value} OFF`}
                                            </span>
                                        </div>
                                    </div>
                                    <button onClick={() => toggleCouponStatus(coupon._id)}>
                                        {coupon.active ? (
                                            <MdToggleOn size={32} className="text-green-500 hover:text-green-600" />
                                        ) : (
                                            <MdToggleOff size={32} className="text-gray-300 hover:text-gray-400" />
                                        )}
                                    </button>
                                </div>

                                <div className="mb-3 border-b border-dashed pb-2">
                                    <h3 className="font-bold text-gray-800 text-sm">{coupon.title || 'Special Offer'}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{coupon.description || 'Limited time discount applicable on checkout.'}</p>

                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {coupon.userSegment && coupon.userSegment !== 'all' && (
                                            <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                                {getSegmentLabel(coupon.userSegment)}
                                            </span>
                                        )}
                                        {coupon.applicableCategory && coupon.applicableCategory !== 'all' && (
                                            <span className="text-[10px] uppercase font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                                {coupon.applicableCategory}
                                            </span>
                                        )}
                                        {coupon.applicableSubCategory && coupon.applicableSubCategory !== 'all' && (
                                            <span className="text-[10px] uppercase font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                                                {coupon.applicableSubCategory}
                                            </span>
                                        )}
                                        {coupon.applicableBrand && coupon.applicableBrand !== 'all' && (
                                            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                {coupon.applicableBrand}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1.5 text-xs text-gray-500">
                                    <div className="flex justify-between">
                                        <span>Min Purchase:</span>
                                        <span className="font-medium text-gray-700">Rs {coupon.minPurchase}</span>
                                    </div>
                                    {coupon.type === 'percentage' && (
                                        <div className="flex justify-between">
                                            <span>Max Discount:</span>
                                            <span className="font-medium text-gray-700">Rs {coupon.maxDiscount}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span>Expires On:</span>
                                        <span className="font-medium text-red-500">{coupon.expiryDate}</span>
                                    </div>
                                </div>

                                <div className="pt-3 mt-3 border-t border-dashed border-gray-200 flex justify-between items-center">
                                    <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">
                                        Used {coupon.usageCount} times
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(coupon)}
                                            className="text-primary-500 hover:text-primary-700 p-1 rounded hover:bg-primary-50 transition"
                                            title="Edit coupon"
                                        >
                                            <MdEdit size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(coupon._id)}
                                            className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                                            title="Delete coupon"
                                        >
                                            <MdDelete size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-50 rounded-full border-r border-gray-300"></div>
                            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-gray-50 rounded-full border-l border-gray-300"></div>
                        </div>
                    ))
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                {isEditing ? <MdEdit className="text-primary-500" /> : <MdAdd className="text-pink-500" />}
                                {isEditing ? 'Edit Coupon' : 'New Coupon'}
                            </h2>
                            <button onClick={resetForm} className="p-1 hover:bg-gray-200 rounded-full transition">
                                <MdClose size={22} className="text-gray-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCouponSubmit} className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Coupon Code</label>
                                    <input
                                        type="text"
                                        value={couponData.code}
                                        onChange={(e) => updateCouponField('code', e.target.value.toUpperCase())}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 outline-none font-mono text-base text-gray-800 uppercase placeholder:text-gray-500"
                                        placeholder="e.g. SAVE20"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={couponData.title}
                                        onChange={(e) => updateCouponField('title', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 outline-none text-base text-gray-800 placeholder:text-gray-500"
                                        placeholder="e.g. Summer Sale"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Discount Type</label>
                                    <select
                                        value={couponData.type}
                                        onChange={(e) => updateCouponField('type', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 outline-none bg-white text-base text-gray-800"
                                    >
                                        <option value="percentage">Percentage (%)</option>
                                        <option value="flat">Flat Amount (Rs)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Discount Value</label>
                                    <input
                                        type="number"
                                        value={couponData.value}
                                        onChange={(e) => updateCouponField('value', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 outline-none text-base text-gray-800 placeholder:text-gray-500"
                                        placeholder={couponData.type === 'percentage' ? 'e.g. 20' : 'e.g. 200'}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                <textarea
                                    value={couponData.description}
                                    onChange={(e) => updateCouponField('description', e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:border-pink-500 outline-none h-24 resize-none text-base text-gray-800 placeholder:text-gray-500"
                                    placeholder="Brief terms or benefits..."
                                    required
                                />
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase border-b border-gray-200 pb-2">Conditions</label>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Applicable For</label>
                                        <select
                                            value={couponData.userSegment}
                                            onChange={(e) => updateCouponField('userSegment', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:border-primary-500 text-sm text-gray-800"
                                        >
                                            <option value="all">All Users</option>
                                            <option value="new_user">New Users Only</option>
                                            <option value="existing_user">Existing Users</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Category</label>
                                        <select
                                            value={couponData.applicableCategory}
                                            onChange={(e) => updateCouponField('applicableCategory', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:border-primary-500 text-sm text-gray-800"
                                        >
                                            <option value="all">All Categories</option>
                                            {categoryOptions.map((category) => (
                                                <option key={category} value={category}>{category}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Subcategory</label>
                                        <select
                                            value={couponData.applicableSubCategory}
                                            onChange={(e) => updateCouponField('applicableSubCategory', e.target.value)}
                                            disabled={isAllCategoriesSelected}
                                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm ${
                                                isAllCategoriesSelected
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-white text-gray-800 focus:border-primary-500'
                                            }`}
                                        >
                                            <option value="all">All Subcategories</option>
                                            {subCategoryOptions.map((subCategory) => (
                                                <option key={subCategory} value={subCategory}>{subCategory}</option>
                                            ))}
                                        </select>
                                        {isAllCategoriesSelected && (
                                            <p className="mt-1 text-[10px] font-medium text-gray-400">
                                                All Categories selected hai, isliye coupon har subcategory par lagega.
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Brand</label>
                                        <select
                                            value={couponData.applicableBrand}
                                            onChange={(e) => updateCouponField('applicableBrand', e.target.value)}
                                            disabled={isAllCategoriesSelected || isAllSubCategoriesSelected}
                                            className={`w-full px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm ${
                                                isAllCategoriesSelected || isAllSubCategoriesSelected
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-white text-gray-800 focus:border-primary-500'
                                            }`}
                                        >
                                            <option value="all">All Brands</option>
                                            {brandOptions.map((brand) => (
                                                <option key={brand} value={brand}>{brand}</option>
                                            ))}
                                        </select>
                                        {(isAllCategoriesSelected || isAllSubCategoriesSelected) && (
                                            <p className="mt-1 text-[10px] font-medium text-gray-400">
                                                {isAllCategoriesSelected
                                                    ? 'All Categories selected hai, isliye coupon sabhi brands par lagega.'
                                                    : 'All Subcategories selected hai, isliye coupon selected category ke sabhi brands par lagega.'}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Min Purchase</label>
                                        <input
                                            type="number"
                                            value={couponData.minPurchase}
                                            onChange={(e) => updateCouponField('minPurchase', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary-500 text-sm text-gray-800 placeholder:text-gray-500"
                                            placeholder="Rs"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Expiry Date</label>
                                        <input
                                            type="date"
                                            value={couponData.expiryDate}
                                            onChange={(e) => updateCouponField('expiryDate', e.target.value)}
                                            min={isEditing ? todayStr : tomorrowStr}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary-500 text-sm text-gray-800"
                                            required
                                        />
                                    </div>
                                    {couponData.type === 'percentage' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Max Discount Limit</label>
                                            <input
                                                type="number"
                                                value={couponData.maxDiscount}
                                                onChange={(e) => updateCouponField('maxDiscount', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-primary-500 text-sm text-gray-800 placeholder:text-gray-500"
                                                placeholder="e.g. 100"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-pink-600 text-white font-bold py-3 rounded-xl hover:bg-pink-700 transition mt-2 shadow-sm"
                            >
                                {isEditing ? 'Update Coupon' : 'Publish Coupon'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CouponManager;
