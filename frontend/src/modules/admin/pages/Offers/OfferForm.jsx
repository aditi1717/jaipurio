import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdSave, MdArrowBack, MdCancel } from 'react-icons/md';
import useOfferStore from '../../store/offerStore';
import API from '../../../../services/api';

const OfferForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = Boolean(id);

    const { createOffer, updateOffer, fetchOfferById, currentOffer, isLoading } = useOfferStore();

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        discountType: 'percentage',
        discountValue: '',
        linkedProducts: [],
        linkedCategories: [],
        linkedSubCategories: [],
        startDate: '',
        endDate: '',
        isActive: true,
        priority: 0,
        termsAndConditions: ''
    });

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [error, setError] = useState('');

    // Fetch dropdown options
    useEffect(() => {
        const fetchOptions = async () => {
            setLoadingOptions(true);
            try {
                const [productsRes, categoriesRes, subCategoriesRes] = await Promise.all([
                    API.get('/products', {
                        params: {
                            all: 'true',
                            lite: 'true'
                        }
                    }),
                    API.get('/categories'),
                    API.get('/subcategories')
                ]);

                setProducts(productsRes.data || []);
                setCategories(categoriesRes.data || []);
                setSubCategories(subCategoriesRes.data || []);
            } catch (err) {
                console.error('Failed to fetch options:', err);
            } finally {
                setLoadingOptions(false);
            }
        };

        fetchOptions();
    }, []);

    // Fetch offer data if editing
    useEffect(() => {
        if (isEditMode && id) {
            const loadOffer = async () => {
                try {
                    const offer = await fetchOfferById(id);
                    setFormData({
                        title: offer.title || '',
                        description: offer.description || '',
                        discountType: offer.discountType || 'percentage',
                        discountValue: offer.discountValue || '',
                        linkedProducts: offer.linkedProducts || [],
                        linkedCategories: offer.linkedCategories?.map(c => c._id) || [],
                        linkedSubCategories: offer.linkedSubCategories?.map(s => s._id) || [],
                        startDate: offer.startDate ? offer.startDate.split('T')[0] : '',
                        endDate: offer.endDate ? offer.endDate.split('T')[0] : '',
                        isActive: offer.isActive !== undefined ? offer.isActive : true,
                        priority: offer.priority || 0,
                        termsAndConditions: offer.termsAndConditions || ''
                    });
                } catch (err) {
                    setError('Failed to load offer');
                }
            };
            loadOffer();
        }
    }, [isEditMode, id]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Add item to array
    const handleAddId = (field, id) => {
        if (!id) return;
        const numId = field === 'linkedProducts' ? Number(id) : id;
        if (!formData[field].includes(numId)) {
            setFormData(prev => ({
                ...prev,
                [field]: [...prev[field], numId]
            }));
        }
    };

    // Remove item from array
    const handleRemoveId = (field, id) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].filter(itemId => itemId !== id)
        }));
    };

    // Helper to get name
    const getName = (list, id) => {
        const item = list.find(i => (i._id === id || i.id === id));
        return item ? item.name : id;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!formData.title || !formData.discountValue || !formData.startDate || !formData.endDate) {
            setError('Please fill in all required fields');
            return;
        }

        if (formData.linkedProducts.length === 0 && 
            formData.linkedCategories.length === 0 && 
            formData.linkedSubCategories.length === 0) {
            setError('Please select at least one product, category, or subcategory');
            return;
        }

        try {
            if (isEditMode) {
                await updateOffer(id, formData);
            } else {
                await createOffer(formData);
            }
            navigate('/admin/offers');
        } catch (err) {
            setError(err.message || 'Failed to save offer');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin/offers')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                >
                    <MdArrowBack size={24} />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                        {isEditMode ? 'Edit Offer' : 'Create New Offer'}
                    </h1>
                    <p className="text-sm text-gray-500 font-medium italic">
                        {isEditMode ? 'Update offer details' : 'Add a new promotional offer'}
                    </p>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                    <p className="text-red-700 font-bold text-sm">{error}</p>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900">Basic Information</h2>
                    
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Offer Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-gray-900 caret-black placeholder:text-gray-500"
                            placeholder="e.g., Summer Sale 2024"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows="3"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-gray-900 caret-black resize-none placeholder:text-gray-500"
                            placeholder="Brief description of the offer..."
                        />
                    </div>
                </div>

                {/* Discount Settings */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900">Discount Settings</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Discount Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="discountType"
                                value={formData.discountType}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-gray-900"
                                required
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="flat">Flat Amount (₹)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Discount Value <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="discountValue"
                                value={formData.discountValue}
                                onChange={handleChange}
                                min="0"
                                step={formData.discountType === 'percentage' ? '1' : '0.01'}
                                max={formData.discountType === 'percentage' ? '100' : undefined}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-gray-900 caret-black placeholder:text-gray-500"
                                placeholder={formData.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Apply Offer To - Three Separate Dropdowns */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900">Apply Offer To</h2>
                    <p className="text-sm text-gray-500">Select one or more products, categories, or subcategories</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Products Dropdown */}
                        <div className="space-y-2 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <label className="text-xs font-bold text-primary-600 uppercase block mb-1">Applicable Products</label>
                            <select 
                                value="" 
                                onChange={(e) => handleAddId('linkedProducts', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-sm text-gray-900 caret-black focus:border-primary-500"
                            >
                                <option value="">+ Add Product</option>
                                {products.map(p => !formData.linkedProducts.includes(p.id) && (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {p.brand ? `- ${p.brand}` : ''}
                                    </option>
                                ))}
                            </select>
                            <div className="flex flex-wrap gap-1.5 mt-2 min-h-[30px]">
                                {formData.linkedProducts.map(id => (
                                    <div key={id} className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 shadow-sm">
                                        <span className="truncate max-w-[100px]">{getName(products, id)}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveId('linkedProducts', id)} 
                                            className="text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <MdCancel />
                                        </button>
                                    </div>
                                ))}
                                {formData.linkedProducts.length === 0 && <span className="text-xs text-gray-400 italic">No products selected</span>}
                            </div>
                        </div>

                        {/* Categories Dropdown */}
                        <div className="space-y-2 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <label className="text-xs font-bold text-primary-600 uppercase block mb-1">Applicable Categories</label>
                            <select 
                                value="" 
                                onChange={(e) => handleAddId('linkedCategories', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-sm text-gray-900 caret-black focus:border-primary-500"
                            >
                                <option value="">+ Add Category</option>
                                {categories.map(c => !formData.linkedCategories.includes(c._id) && (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                            <div className="flex flex-wrap gap-1.5 mt-2 min-h-[30px]">
                                {formData.linkedCategories.map(id => (
                                    <div key={id} className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 shadow-sm">
                                        <span>{getName(categories, id)}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveId('linkedCategories', id)} 
                                            className="text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <MdCancel />
                                        </button>
                                    </div>
                                ))}
                                {formData.linkedCategories.length === 0 && <span className="text-xs text-gray-400 italic">No categories selected</span>}
                            </div>
                        </div>

                        {/* Subcategories Dropdown */}
                        <div className="space-y-2 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <label className="text-xs font-bold text-primary-600 uppercase block mb-1">Applicable Subcategories</label>
                            <select 
                                value="" 
                                onChange={(e) => handleAddId('linkedSubCategories', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg outline-none text-sm text-gray-900 caret-black focus:border-primary-500"
                            >
                                <option value="">+ Add Subcategory</option>
                                {subCategories.map(s => !formData.linkedSubCategories.includes(s._id) && (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                            <div className="flex flex-wrap gap-1.5 mt-2 min-h-[30px]">
                                {formData.linkedSubCategories.map(id => (
                                    <div key={id} className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 shadow-sm">
                                        <span>{getName(subCategories, id)}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveId('linkedSubCategories', id)} 
                                            className="text-red-400 hover:text-red-600 transition-colors"
                                        >
                                            <MdCancel />
                                        </button>
                                    </div>
                                ))}
                                {formData.linkedSubCategories.length === 0 && <span className="text-xs text-gray-400 italic">No subcategories selected</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Duration */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900">Offer Duration</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                Start Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-gray-900"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                End Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                name="endDate"
                                value={formData.endDate}
                                onChange={handleChange}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-gray-900"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Settings */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-gray-900">Additional Settings</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Priority</label>
                            <input
                                type="number"
                                name="priority"
                                value={formData.priority}
                                onChange={handleChange}
                                min="0"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-gray-900 caret-black placeholder:text-gray-500"
                                placeholder="0"
                            />
                            <p className="text-xs text-gray-500 mt-1">Higher priority offers display first</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Terms and Conditions</label>
                        <textarea
                            name="termsAndConditions"
                            value={formData.termsAndConditions}
                            onChange={handleChange}
                            rows="4"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all font-bold text-gray-900 caret-black resize-none placeholder:text-gray-500"
                            placeholder="Enter offer terms and conditions..."
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            name="isActive"
                            checked={formData.isActive}
                            onChange={handleChange}
                            className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                            id="isActive"
                        />
                        <label htmlFor="isActive" className="text-sm font-bold text-gray-700">
                            Activate offer immediately
                        </label>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                    <button
                        type="submit"
                        disabled={isLoading || loadingOptions}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MdSave size={20} />
                        {isEditMode ? 'Update Offer' : 'Create Offer'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/admin/offers')}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default OfferForm;
