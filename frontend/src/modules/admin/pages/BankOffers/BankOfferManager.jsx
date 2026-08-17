import React, { useState, useEffect, useMemo } from 'react';
import { MdLocalOffer, MdDelete, MdAdd, MdCheckCircle, MdCancel, MdEdit } from 'react-icons/md';
import useBankOfferStore from '../../store/bankOfferStore';
import useCategoryStore from '../../store/categoryStore';
import useSubCategoryStore from '../../store/subCategoryStore';
import useBrandStore from '../../store/brandStore';
import useProductStore from '../../store/productStore';
import { toast } from 'react-hot-toast';

const getInitialFormData = () => ({
    offerName: '',
    description: '',
    bankName: '',
    partnerName: '',
    paymentPlatform: 'bank',
    integrationProvider: 'custom',
    discountType: 'percentage',
    discountValue: '',
    minOrderValue: '',
    maxDiscount: '',
    isUniversal: false,
    applicableCategories: [],
    applicableSubCategories: [],
    applicableBrands: [],
    applicableProducts: [],
    razorpayOfferId: ''
});

const BankOfferManager = () => {
    const { offers, fetchOffers, createOffer, updateOffer, deleteOffer, toggleOfferStatus, isLoading } = useBankOfferStore();
    const { categories, fetchCategories } = useCategoryStore();
    const { subCategories, fetchSubCategories } = useSubCategoryStore();
    const { brands, fetchBrands } = useBrandStore();
    const { products, fetchProducts } = useProductStore();
    
    const [formData, setFormData] = useState(getInitialFormData);
    const [editingOfferId, setEditingOfferId] = useState(null);

    const [catSearch, setCatSearch] = useState('');
    const [subCatSearch, setSubCatSearch] = useState('');
    const [brandSearch, setBrandSearch] = useState('');
    const [prodSearch, setProdSearch] = useState('');
    const isEditing = Boolean(editingOfferId);

    const suggestedOffers = [
        { name: '10% Instant Discount on HDFC', bank: 'HDFC Bank', type: 'percentage', value: 10, desc: 'Maximum discount up to ₹1500 on HDFC Credit Cards' },
        { name: '10% Instant Discount on ICICI', bank: 'ICICI Bank', type: 'percentage', value: 10, desc: 'Valid on ICICI Bank Cards and EMI' },
        { name: '14% OFF via Paytm Wallet', bank: 'Paytm', type: 'percentage', value: 14, desc: 'Actual discount calculated by Razorpay on checkout' },
        { name: '₹500 Flat OFF on SBI Card', bank: 'SBI Card', type: 'flat', value: 500, desc: 'Minimum transaction of ₹5000 required' },
        { name: '10% Cashback on PhonePe', bank: 'PhonePe', type: 'percentage', value: 10, desc: 'Applicable on first transaction this month' }
    ];

    const applySuggestion = (s) => {
        setFormData(prev => ({
            ...prev,
            offerName: s.name,
            bankName: s.bank,
            discountType: s.type,
            discountValue: s.value,
            description: s.desc,
            isUniversal: false // Automatically reveal applicability section for customization
        }));
        toast.success(`Template applied: ${s.bank}. Select categories/products below.`);
    };

    useEffect(() => {
        fetchOffers();
        fetchCategories();
        fetchSubCategories();
        fetchBrands();
        fetchProducts();
    }, [fetchOffers, fetchCategories, fetchSubCategories, fetchBrands, fetchProducts]);

    const resetForm = () => {
        setFormData(getInitialFormData());
        setEditingOfferId(null);
        setCatSearch('');
        setSubCatSearch('');
        setBrandSearch('');
        setProdSearch('');
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value 
        }));
    };

    // Generic handler for adding IDs to specific arrays
    const handleAddId = (field, id) => {
        if (!id) return;
        if (!formData[field].includes(id)) {
            setFormData(prev => ({
                ...prev,
                [field]: [...prev[field], id]
            }));
        }
    };

    // Generic handler for removing IDs
    const handleRemoveId = (field, id) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].filter(itemId => itemId !== id)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            discountValue: Number(formData.discountValue),
            minOrderValue: formData.minOrderValue ? Number(formData.minOrderValue) : 0,
            maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : 0
        };
        const success = isEditing
            ? await updateOffer(editingOfferId, payload)
            : await createOffer(payload);
        if (success) {
            resetForm();
        }
    };

    const handleEdit = (offer) => {
        setFormData({
            offerName: offer.offerName || '',
            description: offer.description || '',
            bankName: offer.bankName || '',
            partnerName: offer.partnerName || '',
            paymentPlatform: offer.paymentPlatform || 'bank',
            integrationProvider: offer.integrationProvider || 'custom',
            discountType: offer.discountType || 'percentage',
            discountValue: offer.discountValue ?? '',
            minOrderValue: offer.minOrderValue ?? '',
            maxDiscount: offer.maxDiscount ?? '',
            isUniversal: Boolean(offer.isUniversal),
            applicableCategories: Array.isArray(offer.applicableCategories) ? offer.applicableCategories.map((item) => item?._id || item?.id || item) : [],
            applicableSubCategories: Array.isArray(offer.applicableSubCategories) ? offer.applicableSubCategories.map((item) => item?._id || item?.id || item) : [],
            applicableBrands: Array.isArray(offer.applicableBrands) ? offer.applicableBrands.map((item) => item?._id || item?.id || item) : [],
            applicableProducts: Array.isArray(offer.applicableProducts) ? offer.applicableProducts.map((item) => item?._id || item?.id || item) : [],
            razorpayOfferId: offer.razorpayOfferId || ''
        });
        setEditingOfferId(offer._id);
        setCatSearch('');
        setSubCatSearch('');
        setBrandSearch('');
        setProdSearch('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Helper to get name
    const getName = (list, id) => {
        const item = list.find(i => (i._id === id || i.id === id));
        return item ? item.name : id;
    };

    const platformLabelMap = {
        bank: 'Bank',
        phonepe: 'PhonePe',
        googlepay: 'Google Pay',
        paytm: 'Paytm',
        upi: 'UPI',
        card: 'Card',
        netbanking: 'Net Banking',
        wallet: 'Wallet',
        custom: 'Custom'
    };

    const normalizedSubCategoryOptions = useMemo(() => (
        (Array.isArray(subCategories) ? subCategories : [])
            .map((subCategory) => {
                const optionId = subCategory?._id || subCategory?.id;
                const categoryName = subCategory?.category?.name || '';
                const subCategoryName = subCategory?.name || '';

                if (!optionId || !subCategoryName) return null;

                return {
                    id: optionId,
                    label: categoryName ? `${subCategoryName} (${categoryName})` : subCategoryName
                };
            })
            .filter(Boolean)
    ), [subCategories]);

    const normalizedBrandOptions = useMemo(() => (
        (Array.isArray(brands) ? brands : [])
            .map((brand) => {
                const optionId = brand?._id || brand?.id;
                const brandName = brand?.name || '';
                const subCategoryName = brand?.subcategory?.name || '';
                const categoryName = brand?.subcategory?.category?.name || '';

                if (!optionId || !brandName) return null;

                const scopeLabel = [subCategoryName, categoryName].filter(Boolean).join(' / ');

                return {
                    id: optionId,
                    label: scopeLabel ? `${brandName} (${scopeLabel})` : brandName
                };
            })
            .filter(Boolean)
    ), [brands]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                    <MdLocalOffer size={28} />
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-black text-gray-900">Coordinated Bank Offers</h1>
                    <p className="text-gray-500 font-medium">Create synced offers that actually work via Razorpay Checkout</p>
                </div>
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full border border-green-100">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-[11px] font-black text-green-700 uppercase tracking-wider">Razorpay Integrated</span>
                </div>
            </div>

            {/* Suggested Templates */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {suggestedOffers.map((s, idx) => (
                    <button 
                        key={idx}
                        onClick={() => applySuggestion(s)}
                        className="group p-4 bg-white border-2 border-dashed border-gray-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-all text-left"
                    >
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{s.bank}</p>
                        <p className="text-sm font-bold text-gray-800 line-clamp-1 group-hover:text-indigo-700">{s.name}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">Click to use template</p>
                    </button>
                ))}
            </div>

            {/* Create Offer Form */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-gray-100 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
                
                <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3 relative">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm">1</div>
                    {isEditing ? 'Edit Offer Configuration' : 'Offer Configuration'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-8 relative">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Basic Details */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Offer Name</label>
                            <input type="text" name="offerName" value={formData.offerName} onChange={handleChange} required placeholder="e.g. 10% Off on HDFC" className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none text-gray-900 font-bold transition-all" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase">Payment Platform</label>
                                <select name="paymentPlatform" value={formData.paymentPlatform} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border rounded-lg outline-none text-gray-900 caret-black">
                                    <option value="bank">Bank</option>
                                    <option value="phonepe">PhonePe</option>
                                    <option value="googlepay">Google Pay</option>
                                    <option value="paytm">Paytm</option>
                                    <option value="upi">UPI</option>
                                    <option value="card">Card</option>
                                    <option value="netbanking">Net Banking</option>
                                    <option value="wallet">Wallet</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase">Integration</label>
                                <select name="integrationProvider" value={formData.integrationProvider} onChange={handleChange} className="w-full px-4 py-2 bg-gray-50 border rounded-lg outline-none text-gray-900 caret-black">
                                    <option value="custom">Custom / Manual</option>
                                    <option value="razorpay">Razorpay</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase">Partner Display Name</label>
                                <input type="text" name="partnerName" value={formData.partnerName} onChange={handleChange} placeholder="e.g. PhonePe" className="w-full px-4 py-2 bg-gray-50 border rounded-lg focus:border-purple-500 outline-none text-gray-900 caret-black placeholder:text-gray-500" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Bank Business Name</label>
                            <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} required placeholder="e.g. HDFC Bank" className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none text-gray-900 font-bold transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Razorpay Offer ID <span className="text-orange-500">(Required for auto-discount)</span></label>
                            <input type="text" name="razorpayOfferId" value={formData.razorpayOfferId} onChange={handleChange} placeholder="e.g. offer_JId15q34qV1d23" className="w-full px-5 py-3 bg-indigo-50/30 border-2 border-indigo-100 focus:border-indigo-500 focus:bg-white rounded-2xl outline-none text-indigo-700 font-black placeholder:text-indigo-300 transition-all" />
                            <p className="text-[10px] text-gray-400 font-medium ml-1 leading-relaxed mt-1">
                                Get this from <a href="https://dashboard.razorpay.com/app/offers" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-black underline underline-offset-2 hover:text-indigo-800">Razorpay Dashboard → Offers</a>
                            </p>
                        </div>
                    </div>

                    {/* How It Works Guide */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-amber-100 rounded-full -mr-10 -mt-10 opacity-40"></div>
                        <h3 className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-4 flex items-center gap-2 relative">
                            <span className="material-icons text-[16px]">lightbulb</span>
                            How Auto-Discount Works
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 shrink-0 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-black">1</div>
                                <div>
                                    <p className="text-[11px] font-black text-gray-800 mb-0.5">Create in Razorpay</p>
                                    <p className="text-[10px] text-gray-500 leading-relaxed">Go to Razorpay Dashboard → Offers → Create Offer. Set the payment method (e.g. Paytm), discount, and validity.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 shrink-0 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center text-xs font-black">2</div>
                                <div>
                                    <p className="text-[11px] font-black text-gray-800 mb-0.5">Copy the Offer ID</p>
                                    <p className="text-[10px] text-gray-500 leading-relaxed">Once created, Razorpay gives you an ID like <code className="bg-amber-100 px-1 py-0.5 rounded text-[9px] font-mono font-black text-amber-800">offer_JId15q34qV1d23</code>. Paste it above.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-7 h-7 shrink-0 rounded-full bg-green-200 text-green-900 flex items-center justify-center text-xs font-black">✓</div>
                                <div>
                                    <p className="text-[11px] font-black text-gray-800 mb-0.5">Auto-Applied at Checkout</p>
                                    <p className="text-[10px] text-gray-500 leading-relaxed">Razorpay's engine will validate & apply the discount in real-time when the customer pays using the eligible method.</p>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase">Min Order Value</label>
                                <input type="number" name="minOrderValue" value={formData.minOrderValue} onChange={handleChange} placeholder="e.g. 5000" className="w-full px-4 py-2 bg-gray-50 border rounded-lg outline-none text-gray-900 caret-black placeholder:text-gray-500" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase">Max Discount</label>
                                <input type="number" name="maxDiscount" value={formData.maxDiscount} onChange={handleChange} placeholder="Optional cap" className="w-full px-4 py-2 bg-gray-50 border rounded-lg outline-none text-gray-900 caret-black placeholder:text-gray-500" />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Discount Type</label>
                            <select name="discountType" value={formData.discountType} onChange={handleChange} className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none text-gray-900 font-bold appearance-none cursor-pointer">
                                <option value="percentage">Percentage (%)</option>
                                <option value="flat">Flat Amount (₹)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Discount Value</label>
                            <input type="number" name="discountValue" value={formData.discountValue} onChange={handleChange} required placeholder="e.g. 10" className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none text-gray-900 font-black" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Description</label>
                            <input type="text" name="description" value={formData.description} onChange={handleChange} placeholder="Details about this offer" className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none text-gray-900 font-medium" />
                        </div>
                    </div>

                    {/* Applicability Logic */}
                    <div className="pt-6 border-t font-medium">
                        <div className="mb-6 flex flex-col md:flex-row items-center justify-between bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100/50">
                            <div className="flex items-center gap-4 mb-4 md:mb-0">
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        id="isUniversal"
                                        name="isUniversal" 
                                        checked={formData.isUniversal} 
                                        onChange={handleChange} 
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                    <label htmlFor="isUniversal" className="ml-3 text-sm font-black text-gray-900 cursor-pointer select-none">Make this Storewide Offer?</label>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`material-icons text-[18px] ${formData.isUniversal ? 'text-green-500' : 'text-orange-500'}`}>
                                    {formData.isUniversal ? 'public' : 'filter_alt'}
                                </span>
                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                                    {formData.isUniversal ? 'Universal Reach' : 'Specific Targeting Active'}
                                </span>
                            </div>
                        </div>

                        {!formData.isUniversal && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                
                                {/* Categories */}
                                <div className="space-y-4 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Applicable Categories</label>
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{formData.applicableCategories.length} Selected</span>
                                    </div>
                                    
                                    <div className="relative group">
                                        <input 
                                            type="text" 
                                            placeholder="Search categories..." 
                                            value={catSearch}
                                            onChange={(e) => setCatSearch(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none text-xs font-bold text-gray-900 transition-all mb-2"
                                        />
                                        <select 
                                            value="" 
                                            onChange={(e) => {
                                                handleAddId('applicableCategories', e.target.value);
                                                setCatSearch('');
                                            }}
                                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none text-xs font-bold text-gray-900 appearance-none cursor-pointer"
                                        >
                                            <option value="">+ Add Category</option>
                                            {categories
                                                .filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
                                                .filter(c => !formData.applicableCategories.includes(c._id))
                                                .map(c => (
                                                    <option key={c._id} value={c._id}>{c.name}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <div className="flex flex-wrap gap-2 min-h-[40px] pt-2">
                                        {formData.applicableCategories.map(id => (
                                            <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full animate-in zoom-in duration-200">
                                                <span className="text-[11px] font-black text-indigo-700">{getName(categories, id)}</span>
                                                <button type="button" onClick={() => handleRemoveId('applicableCategories', id)} className="text-indigo-400 hover:text-red-500 transition-colors"><MdCancel size={16} /></button>
                                            </div>
                                        ))}
                                        {formData.applicableCategories.length === 0 && <span className="text-xs text-gray-400 italic px-2">No categories selected</span>}
                                    </div>
                                </div>

                                {/* Subcategories */}
                                <div className="space-y-4 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Applicable Subcategories</label>
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{formData.applicableSubCategories.length} Selected</span>
                                    </div>

                                    <div className="relative group">
                                        <input 
                                            type="text" 
                                            placeholder="Search subcategories..." 
                                            value={subCatSearch}
                                            onChange={(e) => setSubCatSearch(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none text-xs font-bold text-gray-900 transition-all mb-2"
                                        />
                                        <select 
                                            value="" 
                                            onChange={(e) => {
                                                handleAddId('applicableSubCategories', e.target.value);
                                                setSubCatSearch('');
                                            }}
                                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none text-xs font-bold text-gray-900 appearance-none cursor-pointer"
                                        >
                                            <option value="">+ Add Subcategory</option>
                                            {normalizedSubCategoryOptions
                                                .filter(s => s.label.toLowerCase().includes(subCatSearch.toLowerCase()))
                                                .filter(s => !formData.applicableSubCategories.includes(s.id))
                                                .map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <div className="flex flex-wrap gap-2 min-h-[40px] pt-2">
                                        {formData.applicableSubCategories.map(id => (
                                            <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-full animate-in zoom-in duration-200">
                                                <span className="text-[11px] font-black text-purple-700">{normalizedSubCategoryOptions.find(s => s.id === id)?.label || getName(subCategories, id)}</span>
                                                <button type="button" onClick={() => handleRemoveId('applicableSubCategories', id)} className="text-purple-400 hover:text-red-500 transition-colors"><MdCancel size={16} /></button>
                                            </div>
                                        ))}
                                        {formData.applicableSubCategories.length === 0 && <span className="text-xs text-gray-400 italic px-2">No subcategories selected</span>}
                                    </div>
                                </div>

                                {/* Brands */}
                                <div className="space-y-4 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Applicable Brands</label>
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{formData.applicableBrands.length} Selected</span>
                                    </div>

                                    <div className="relative group">
                                        <input
                                            type="text"
                                            placeholder="Search brands..."
                                            value={brandSearch}
                                            onChange={(e) => setBrandSearch(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none text-xs font-bold text-gray-900 transition-all mb-2"
                                        />
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                handleAddId('applicableBrands', e.target.value);
                                                setBrandSearch('');
                                            }}
                                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none text-xs font-bold text-gray-900 appearance-none cursor-pointer"
                                        >
                                            <option value="">+ Add Brand</option>
                                            {normalizedBrandOptions
                                                .filter((brand) => brand.label.toLowerCase().includes(brandSearch.toLowerCase()))
                                                .filter((brand) => !formData.applicableBrands.includes(brand.id))
                                                .map((brand) => (
                                                    <option key={brand.id} value={brand.id}>{brand.label}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <div className="flex flex-wrap gap-2 min-h-[40px] pt-2">
                                        {formData.applicableBrands.map((id) => (
                                            <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 border border-cyan-100 rounded-full animate-in zoom-in duration-200">
                                                <span className="text-[11px] font-black text-cyan-700">{normalizedBrandOptions.find((brand) => brand.id === id)?.label || getName(brands, id)}</span>
                                                <button type="button" onClick={() => handleRemoveId('applicableBrands', id)} className="text-cyan-400 hover:text-red-500 transition-colors"><MdCancel size={16} /></button>
                                            </div>
                                        ))}
                                        {formData.applicableBrands.length === 0 && <span className="text-xs text-gray-400 italic px-2">No brands selected</span>}
                                    </div>
                                </div>

                                {/* Products */}
                                <div className="space-y-4 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block">Applicable Products</label>
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{formData.applicableProducts.length} Selected</span>
                                    </div>

                                    <div className="relative group">
                                        <input 
                                            type="text" 
                                            placeholder="Search products..." 
                                            value={prodSearch}
                                            onChange={(e) => setProdSearch(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none text-xs font-bold text-gray-900 transition-all mb-2"
                                        />
                                        <select 
                                            value="" 
                                            onChange={(e) => {
                                                handleAddId('applicableProducts', e.target.value);
                                                setProdSearch('');
                                            }}
                                            className="w-full px-4 py-2.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none text-xs font-bold text-gray-900 appearance-none cursor-pointer"
                                        >
                                            <option value="">+ Add Product</option>
                                            {products
                                                .filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()))
                                                .filter(p => !formData.applicableProducts.includes(p._id || p.id))
                                                .map(p => (
                                                    <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    <div className="flex flex-wrap gap-2 min-h-[40px] pt-2">
                                        {formData.applicableProducts.map(id => (
                                            <div key={id} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full animate-in zoom-in duration-200">
                                                <span className="text-[11px] font-black text-emerald-700 max-w-[120px] truncate">{getName(products, id)}</span>
                                                <button type="button" onClick={() => handleRemoveId('applicableProducts', id)} className="text-emerald-400 hover:text-red-500 transition-colors"><MdCancel size={16} /></button>
                                            </div>
                                        ))}
                                        {formData.applicableProducts.length === 0 && <span className="text-xs text-gray-400 italic px-2">No products selected</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="mt-8 flex justify-end">
                            <div className="flex items-center gap-3">
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-6 py-4 bg-white text-gray-700 font-black rounded-2xl border border-gray-200 hover:bg-gray-50 transition"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                                <button type="submit" disabled={isLoading} className="px-12 py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800 transition shadow-2xl shadow-gray-200 disabled:opacity-70 flex items-center gap-2">
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        {isEditing ? 'Updating Offer...' : 'Saving Offer...'}
                                    </>
                                ) : (
                                    <>
                                        {isEditing ? <MdEdit size={20} /> : <MdAdd size={20} />}
                                        {isEditing ? 'Update Bank Offer' : 'Launch Bank Offer'}
                                    </>
                                )}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            
            {/* Active Offers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {offers.map(offer => (
                    <div key={offer._id} className="group bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                        <div className="flex justify-between items-start mb-5">
                            <div className="flex flex-col gap-1">
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-full uppercase tracking-widest w-fit border border-indigo-100">
                                    {offer.partnerName || platformLabelMap[offer.paymentPlatform] || offer.bankName}
                                </span>
                                {offer.integrationProvider === 'razorpay' && offer.razorpayOfferId && (
                                    <span className="text-[9px] font-black text-green-600 uppercase mt-1 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full border border-green-100 w-fit">
                                        <MdCheckCircle /> Razorpay Synced
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => toggleOfferStatus(offer._id)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${offer.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                    {offer.isActive ? <MdCheckCircle size={20} /> : <MdCancel size={20} />}
                                </button>
                                <button onClick={() => handleEdit(offer)} className="w-8 h-8 rounded-full bg-primary-50 text-primary-500 hover:bg-primary-500 hover:text-white flex items-center justify-center transition-all">
                                    <MdEdit size={18} />
                                </button>
                                <button onClick={() => deleteOffer(offer._id)} className="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all">
                                    <MdDelete size={18} />
                                </button>
                            </div>
                        </div>
                        
                        <h3 className="text-xl font-black text-gray-900 leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{offer.offerName}</h3>
                        <p className="text-sm text-gray-500 mb-6 font-medium line-clamp-2 leading-relaxed">{offer.description || 'No description provided.'}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[11px] font-semibold rounded-full uppercase tracking-tight">
                                {platformLabelMap[offer.paymentPlatform] || 'Bank'}
                            </span>
                            <span className="px-2 py-1 bg-primary-50 text-primary-700 text-[11px] font-semibold rounded-full uppercase tracking-tight">
                                {offer.integrationProvider === 'razorpay' ? 'Razorpay' : 'Custom / Manual'}
                            </span>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                            <div>
                                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Discount</p>
                                <p className="font-black text-gray-900 text-lg italic">
                                    {offer.discountType === 'flat' ? '₹' + offer.discountValue : offer.discountValue + '%'} <span className="text-indigo-600 text-sm">OFF</span>
                                </p>
                                {(offer.minOrderValue || offer.maxDiscount) ? (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        {offer.minOrderValue ? `Min ₹${offer.minOrderValue}` : ''}
                                        {offer.minOrderValue && offer.maxDiscount ? ' • ' : ''}
                                        {offer.maxDiscount ? `Max ₹${offer.maxDiscount}` : ''}
                                    </p>
                                ) : null}
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-0.5">Scope</p>
                                <p className="font-black text-indigo-600 uppercase text-[10px] tracking-tight">
                                    {offer.isUniversal ? 'Entire Store' : [
                                        offer.applicableCategories?.length > 0 && `${offer.applicableCategories.length} Categories`,
                                        offer.applicableSubCategories?.length > 0 && `${offer.applicableSubCategories.length} Sub-cats`,
                                        offer.applicableBrands?.length > 0 && `${offer.applicableBrands.length} Brands`,
                                        offer.applicableProducts?.length > 0 && `${offer.applicableProducts.length} Specific Prods`
                                    ].filter(Boolean).join(' • ') || 'None'}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BankOfferManager;
