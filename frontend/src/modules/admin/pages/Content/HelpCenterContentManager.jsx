import React, { useMemo, useState, useEffect } from 'react';
import { MdAdd, MdDelete } from 'react-icons/md';
import toast from 'react-hot-toast';
import { useContentStore } from '../../store/contentStore';

const HELP_CENTER_CONFIG_KEY = 'help-center-config';
const ICON_OPTIONS = [
    { value: 'local_shipping', label: 'Shipping', type: 'Material Icon' },
    { value: 'account_balance_wallet', label: 'Wallet', type: 'Material Icon' },
    { value: 'manage_accounts', label: 'Account', type: 'Material Icon' },
    { value: 'delivery_dining', label: 'Delivery', type: 'Material Icon' },
    { value: 'local_offer', label: 'Offer', type: 'Material Icon' },
    { value: 'storefront', label: 'Storefront', type: 'Material Icon' },
    { value: 'security', label: 'Security', type: 'Material Icon' },
    { value: 'stars', label: 'Stars', type: 'Material Icon' },
    { value: 'help', label: 'Help', type: 'Material Icon' }
];

const createFaq = () => ({
    id: `faq-${Date.now()}-${Math.random()}`,
    question: '',
    answer: ''
});

const createCategory = () => ({
    id: `cat-${Date.now()}-${Math.random()}`,
    title: 'New Category',
    icon: 'help',
    desc: '',
    faqs: []
});

const defaultConfig = {
    pageTitle: 'Help Center',
    pageSubtitle: 'Hum aapki madad ke liye hamesha taiyaar hain',
    searchPlaceholderDesktop: 'Kisi bhi topic ke baare mein search karein...',
    searchPlaceholderMobile: 'Apni problem type karein...',
    categories: [
        {
            id: 'orders',
            title: 'My Orders',
            icon: 'local_shipping',
            desc: 'Track, cancel & returns',
            faqs: [
                {
                    id: 'orders-faq-1',
                    question: 'Main apna order kaise track karoon?',
                    answer: 'My Orders section mein jayein, order select karein aur Track Order par click karein.'
                }
            ]
        },
        {
            id: 'payments',
            title: 'Payments',
            icon: 'account_balance_wallet',
            desc: 'Refunds & failed payments',
            faqs: [
                {
                    id: 'payments-faq-1',
                    question: 'Payment deduct ho gayi lekin order place nahi hua?',
                    answer: 'Amount usually 7 business days mein auto-reverse ho jata hai.'
                }
            ]
        },
        {
            id: 'account',
            title: 'My Account',
            icon: 'manage_accounts',
            desc: 'Login, security & profile',
            faqs: [
                {
                    id: 'account-faq-1',
                    question: 'Password bhool gaya, reset kaise karoon?',
                    answer: 'Login page par Forgot Password option se OTP verify karke new password set karein.'
                }
            ]
        },
        {
            id: 'delivery',
            title: 'Delivery',
            icon: 'delivery_dining',
            desc: 'Delays & tracking issues',
            faqs: [
                {
                    id: 'delivery-faq-1',
                    question: 'Order late ho gaya toh kya karna hai?',
                    answer: 'My Orders me latest tracking check karein aur issue report kar sakte hain.'
                }
            ]
        },
        {
            id: 'offers',
            title: 'Offers & Coupons',
            icon: 'local_offer',
            desc: 'Discounts & deals',
            faqs: [
                {
                    id: 'offers-faq-1',
                    question: 'Coupon apply nahi ho raha hai?',
                    answer: 'Coupon expiry, minimum cart value, aur eligible products/payment method verify karein.'
                }
            ]
        },
        {
            id: 'products',
            title: 'Products & Sellers',
            icon: 'storefront',
            desc: 'Wrong item & quality issues',
            faqs: [
                {
                    id: 'products-faq-1',
                    question: 'Wrong product mila toh kya karna hai?',
                    answer: 'My Orders me Wrong Item Received report karein aur return/replacement process start karein.'
                }
            ]
        },
        {
            id: 'safety',
            title: 'Safety & Fraud',
            icon: 'security',
            desc: 'Scam alerts & account security',
            faqs: [
                {
                    id: 'safety-faq-1',
                    question: 'Fraud call aaye toh kya karein?',
                    answer: 'OTP/password share na karein, number block karein aur cyber helpline par report karein.'
                }
            ]
        },
        {
            id: 'rewards',
            title: 'Jaipurio Rewards',
            icon: 'stars',
            desc: 'Coins & loyalty benefits',
            faqs: [
                {
                    id: 'rewards-faq-1',
                    question: 'Coins kaise earn aur redeem karein?',
                    answer: 'Successful orders aur offers se coins earn hote hain; checkout par redeem kar sakte hain.'
                }
            ]
        }
    ]
};

const normalizeConfig = (value) => {
    if (!value || typeof value !== 'object') return defaultConfig;

    const categories = Array.isArray(value.categories) && value.categories.length > 0
        ? value.categories
        : defaultConfig.categories;

    return {
        pageTitle: value.pageTitle || defaultConfig.pageTitle,
        pageSubtitle: value.pageSubtitle || defaultConfig.pageSubtitle,
        searchPlaceholderDesktop: value.searchPlaceholderDesktop || value.searchPlaceholder || defaultConfig.searchPlaceholderDesktop,
        searchPlaceholderMobile: value.searchPlaceholderMobile || defaultConfig.searchPlaceholderMobile,
        categories: categories.map((cat, catIdx) => ({
            id: cat?.id || `cat-${catIdx + 1}`,
            title: cat?.title || `Category ${catIdx + 1}`,
            icon: cat?.icon || 'help',
            desc: cat?.desc || '',
            faqs: (Array.isArray(cat?.faqs) ? cat.faqs : []).map((faq, faqIdx) => ({
                id: faq?.id || `${cat?.id || `cat-${catIdx + 1}`}-faq-${faqIdx + 1}`,
                question: faq?.question || '',
                answer: faq?.answer || ''
            }))
        }))
    };
};

const HelpCenterContentManager = () => {
    const { pages, fetchPages, updateContent, isLoading } = useContentStore();
    const [config, setConfig] = useState(defaultConfig);
    const [selectedCategoryId, setSelectedCategoryId] = useState(defaultConfig.categories[0]?.id || '');

    useEffect(() => {
        fetchPages();
    }, [fetchPages]);

    useEffect(() => {
        const page = pages.find((p) => p.pageKey === HELP_CENTER_CONFIG_KEY);
        if (page?.content) {
            try {
                const parsed = JSON.parse(page.content);
                const normalized = normalizeConfig(parsed);
                setConfig(normalized);
                setSelectedCategoryId((prev) => prev || normalized.categories[0]?.id || '');
            } catch (error) {
                // Keep default config when malformed content exists.
            }
        }
    }, [pages]);

    const selectedCategory = useMemo(
        () => config.categories.find((cat) => cat.id === selectedCategoryId) || null,
        [config.categories, selectedCategoryId]
    );

    const updateConfigField = (field, value) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
    };

    const updateCategoryField = (categoryId, field, value) => {
        setConfig((prev) => ({
            ...prev,
            categories: prev.categories.map((cat) => (
                cat.id === categoryId ? { ...cat, [field]: value } : cat
            ))
        }));
    };

    const updateFaq = (categoryId, faqId, field, value) => {
        setConfig((prev) => ({
            ...prev,
            categories: prev.categories.map((cat) => {
                if (cat.id !== categoryId) return cat;
                return {
                    ...cat,
                    faqs: cat.faqs.map((faq) => (faq.id === faqId ? { ...faq, [field]: value } : faq))
                };
            })
        }));
    };

    const addCategory = () => {
        const newCategory = createCategory();
        setConfig((prev) => ({
            ...prev,
            categories: [...prev.categories, newCategory]
        }));
        setSelectedCategoryId(newCategory.id);
    };

    const removeCategory = (categoryId) => {
        setConfig((prev) => {
            const nextCategories = prev.categories.filter((cat) => cat.id !== categoryId);
            if (nextCategories.length === 0) {
                const fallback = createCategory();
                setSelectedCategoryId(fallback.id);
                return { ...prev, categories: [fallback] };
            }
            if (selectedCategoryId === categoryId) {
                setSelectedCategoryId(nextCategories[0].id);
            }
            return { ...prev, categories: nextCategories };
        });
    };

    const addFaq = (categoryId) => {
        setConfig((prev) => ({
            ...prev,
            categories: prev.categories.map((cat) => (
                cat.id === categoryId ? { ...cat, faqs: [...cat.faqs, createFaq()] } : cat
            ))
        }));
    };

    const removeFaq = (categoryId, faqId) => {
        setConfig((prev) => ({
            ...prev,
            categories: prev.categories.map((cat) => {
                if (cat.id !== categoryId) return cat;
                const nextFaqs = cat.faqs.filter((faq) => faq.id !== faqId);
                return { ...cat, faqs: nextFaqs };
            })
        }));
    };

    const saveDraft = async () => {
        try {
            await updateContent(HELP_CENTER_CONFIG_KEY, JSON.stringify(config));
            await fetchPages();
            toast.success('Help Center content saved to DB');
        } catch (error) {
            toast.error('Failed to save Help Center content');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Help Center Content</h1>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={saveDraft}
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-semibold disabled:opacity-60"
                    >
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Page Title</label>
                    <input
                        value={config.pageTitle}
                        onChange={(e) => updateConfigField('pageTitle', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Subtitle</label>
                    <input
                        value={config.pageSubtitle}
                        onChange={(e) => updateConfigField('pageSubtitle', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Search Placeholder (Desktop)</label>
                    <input
                        value={config.searchPlaceholderDesktop}
                        onChange={(e) => updateConfigField('searchPlaceholderDesktop', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Search Placeholder (Mobile)</label>
                    <input
                        value={config.searchPlaceholderMobile}
                        onChange={(e) => updateConfigField('searchPlaceholderMobile', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">
                <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 p-3 h-fit">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-gray-800">Categories</h2>
                        <button
                            onClick={addCategory}
                            className="text-xs px-2 py-1 bg-primary-50 text-primary-700 rounded-md flex items-center gap-1"
                        >
                            <MdAdd /> Add
                        </button>
                    </div>
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {config.categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={`w-full text-left border rounded-lg px-3 py-2 transition ${selectedCategoryId === cat.id ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-800">{cat.title || 'Untitled'}</span>
                                    <span className="text-[10px] text-gray-500">{cat.faqs.length} FAQs</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-6 bg-white rounded-xl border border-gray-100 p-4">
                    {!selectedCategory ? (
                        <p className="text-gray-500 text-sm">Select a category to edit.</p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-base font-bold text-gray-800">Edit Category</h2>
                                <button
                                    onClick={() => removeCategory(selectedCategory.id)}
                                    className="text-red-600 text-sm flex items-center gap-1"
                                >
                                    <MdDelete /> Remove Category
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Title</label>
                                    <input
                                        value={selectedCategory.title}
                                        onChange={(e) => updateCategoryField(selectedCategory.id, 'title', e.target.value)}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Icon</label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={selectedCategory.icon}
                                            onChange={(e) => updateCategoryField(selectedCategory.id, 'icon', e.target.value)}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900"
                                        >
                                            {ICON_OPTIONS.map((icon) => (
                                                <option key={icon.value} value={icon.value}>
                                                    {icon.label} ({icon.value}) - {icon.type}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="w-10 h-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
                                            <span className="material-icons text-primary-600 text-[20px]">
                                                {selectedCategory.icon || 'help'}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        Type: {ICON_OPTIONS.find((icon) => icon.value === selectedCategory.icon)?.type || 'Material Icon'}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-100 pt-3">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-gray-800">FAQs</h3>
                                    <button
                                        onClick={() => addFaq(selectedCategory.id)}
                                        className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md flex items-center gap-1"
                                    >
                                        <MdAdd /> Add FAQ
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {selectedCategory.faqs.map((faq, index) => (
                                        <div key={faq.id} className="border border-gray-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs font-semibold text-gray-500 uppercase">FAQ {index + 1}</p>
                                                <button
                                                    onClick={() => removeFaq(selectedCategory.id, faq.id)}
                                                    className="text-red-500 text-xs flex items-center gap-1"
                                                >
                                                    <MdDelete /> Remove
                                                </button>
                                            </div>
                                            <input
                                                value={faq.question}
                                                onChange={(e) => updateFaq(selectedCategory.id, faq.id, 'question', e.target.value)}
                                                placeholder="Question"
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 bg-white text-gray-900 placeholder:text-gray-400"
                                            />
                                            <textarea
                                                value={faq.answer}
                                                onChange={(e) => updateFaq(selectedCategory.id, faq.id, 'answer', e.target.value)}
                                                placeholder="Answer"
                                                rows={4}
                                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y bg-white text-gray-900 placeholder:text-gray-400"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
            <p className="text-[11px] text-gray-500">
                Saving writes JSON to Content Pages table with key `help-center-config`.
            </p>
        </div>
    );
};

export default HelpCenterContentManager;
