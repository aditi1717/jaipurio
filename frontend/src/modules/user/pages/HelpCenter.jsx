import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';

const HELP_CENTER_CONFIG_KEY = 'help-center-config';

const defaultCategories = [
    {
        id: 'orders',
        title: 'My Orders',
        icon: 'local_shipping',
        desc: 'Track, cancel & returns',
        faqs: [
            {
                question: 'Main apna order kaise track karoon?',
                answer: '"My Orders" section mein jayein, apna order select karein aur "Track Order" button click karein. Aapko real-time delivery status aur expected delivery date milega.'
            },
            {
                question: 'Main apna order kaise cancel karoon?',
                answer: '"My Orders" mein jayein → order select karein → "Cancel Order" click karein. Note: Shipping ke baad cancellation available nahi hoti. Refund 5-7 business days mein aata hai.'
            },
            {
                question: 'Return request kaise file karein?',
                answer: '"My Orders" mein jayein → item select karein → "Return" button click karein → return reason choose karein → pickup schedule karein. Pickup 2-4 days mein aata hai.'
            },
            {
                question: 'Exchange kaise karein?',
                answer: '"My Orders" mein jayein → "Exchange" option select karein → nayi size/color choose karein → pickup aur delivery ek saath schedule hogi.'
            },
            {
                question: 'Order cancel ke baad refund kab milega?',
                answer: 'Refund original payment method mein jayega: Credit/Debit card: 5-7 business days | UPI/Wallets: 1-3 business days | Net Banking: 3-5 business days.'
            },
            {
                question: 'Partial order mila — kya karoon?',
                answer: 'Agar aapka order incomplete mila toh "My Orders" mein jayein aur "Item Missing" report karein. Hamare team 24 hours mein contact karegi.'
            },
            {
                question: 'Delivered dikhaa raha hai lekin order mila nahi?',
                answer: '"My Orders" mein "Not Received" report karein. Investigation ke baad replacement ya full refund diya jayega. Pehle neighbours aur security desk mein check karein.'
            },
            {
                question: 'Return window kab tak hai?',
                answer: 'Most items ke liye return window delivery ke 10 din baad tak hai. Electronics ke liye 7 days, perishables ke liye return nahi hota. Product page par exact policy dekh sakte hain.'
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
                question: 'Payment kat gayi lekin order nahi hua — kya karoon?',
                answer: 'Ghabrayein nahi — agar payment deducted ho gayi aur order nahi hua toh amount 7 business days mein automatically reverse ho jata hai. Nahi hua toh "Contact Support" se report karein.'
            },
            {
                question: 'EMI options kaise use karein?',
                answer: 'Checkout par "More Payment Options" → "EMI" select karein. Apna bank aur EMI tenure choose karein. Minimum cart value ₹3000 hona chahiye. No-cost EMI bhi available hai select items par.'
            },
            {
                question: 'Wallet mein paisa kaise add karoon?',
                answer: '"My Account" → "My Wallet" → "Add Money" click karein. UPI, Net Banking ya Card se top-up kar sakte hain.'
            },
            {
                question: 'GST Invoice kahan milegi?',
                answer: '"My Orders" → order select karein → "Download Invoice" button click karein. Invoice PDF format mein download hogi.'
            },
            {
                question: 'COD kyun available nahi ho raha meri location par?',
                answer: 'COD (Cash on Delivery) kuch pin codes par available nahi hoti due to delivery partner limitations. Prepaid options use karein.'
            },
            {
                question: 'Refund status kaise check karein?',
                answer: '"My Orders" → specific order → "Refund Status" dekh sakte hain. Ya apni bank app mein transaction history check karein.'
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
                question: 'Password bhool gaya — reset kaise karoon?',
                answer: 'Login page par "Forgot Password" click karein → registered email/phone daalein → OTP aayega → naya password set karein. OTP 10 minutes tak valid hai.'
            },
            {
                question: 'Phone number change kaise karoon?',
                answer: '"My Account" → "Edit Profile" → phone number ke paas edit icon click karein → OTP verify karein → naya number save karein.'
            },
            {
                question: 'Account delete karna hai',
                answer: '"My Account" → "Settings" → "Delete Account" option mein jayein. Note: Account delete hone par sare orders, wishlist aur wallet balance permanently remove ho jayenge.'
            },
            {
                question: 'Saved addresses kaise manage karoon?',
                answer: '"My Account" → "Saved Addresses" → Add, Edit ya Delete kar sakte hain. Default address bhi set kar sakte hain checkout ke liye.'
            },
            {
                question: 'Ek account mein multiple email/phones add kar sakte hain?',
                answer: 'Abhi ek account ek phone number se linked hota hai. Email alag se add karna possible hai "My Account → Edit Profile" se.'
            },
            {
                question: 'Login problem ho rahi hai — OTP nahi aa raha',
                answer: 'OTP nahi aaya? 30 seconds wait karein phir "Resend OTP" click karein. Spam folder bhi check karein. Network issue hone par WiFi/mobile data switch karein.'
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
                question: 'Order expected date ke baad bhi nahi aaya',
                answer: '"My Orders" mein latest tracking status check karein. Agar "Out for Delivery" show ho raha hai toh same day milega. Delay hone par "Report an Issue" use karein — replacement ya refund milega.'
            },
            {
                question: 'Delivery agent ka contact number kaise milega?',
                answer: 'Jab order "Out for Delivery" status mein ho, "My Orders" mein delivery agent ka number temporary basis par dikhta hai.'
            },
            {
                question: 'Delivery address last minute change karna hai',
                answer: 'Shipping se pehle "My Orders" → "Modify Order" → address change ho sakta hai. Shipping ke baad address change possible nahi hai — order cancel karke naya order karein.'
            },
            {
                question: '"Delivery Attempted" show ho raha hai lekin ghar par koi tha',
                answer: '"My Orders" mein "Delivery Not Attempted" report karein. Ek aur attempt schedule ho jayega agle business day mein.'
            },
            {
                question: 'Express/Same day delivery kaise milegi?',
                answer: 'Product listing par "Express Delivery" badge check karein. Available hone par checkout mein express option select karein. Availability pin code aur time of order par depend karti hai.'
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
                question: 'Coupon code apply nahi ho raha — kya karoon?',
                answer: 'Coupon expiry date check karein | Minimum cart value requirement check karein | Coupon specific categories ke liye toh relevant products add karein | Bank coupons ke liye correct payment method use karein.'
            },
            {
                question: 'Bank offer kaise claim karein?',
                answer: 'Checkout par eligible bank ka card/UPI use karein — discount automatically apply ho jata hai. Koi manual code nahi daalna hota.'
            },
            {
                question: 'Sale offers kab aate hain?',
                answer: 'Jaipurio par festivals ke time special sales hoti hain. App notifications ON karein sale alerts ke liye. "Offers" section mein current deals dekh sakte hain.'
            },
            {
                question: 'Referral bonus kaise use karein?',
                answer: '"My Account" → "Refer & Earn" mein apna referral code milega. Friend sign up karne par dono ko bonus milta hai — wallet ya discount coupon ke roop mein.'
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
                question: 'Wrong product deliver hua — kya process hai?',
                answer: '"My Orders" → item select → "Wrong Item Received" report karein → photos upload karein → return pickup schedule hogi → correct item dispatch ho jayega ya full refund milega.'
            },
            {
                question: 'Damaged product mila — kya karoon?',
                answer: 'Delivery ke time hi packaging damage check karein. "My Orders" → "Damaged Product" report karein within 48 hours. Unboxing video/photos se claim jaldi resolve hota hai.'
            },
            {
                question: 'Product genuine hai ya fake — kaise check karein?',
                answer: 'Jaipurio par sirf authorized sellers hain. "Sold by" section mein seller details check karein. Authenticity doubt hone par report karein — strict action liya jata hai.'
            },
            {
                question: 'Product description se alag item aaya',
                answer: '"My Orders" → "Item Not as Described" report karein with photos. Return process initiate ho jayega bina extra cost ke.'
            },
            {
                question: 'Seller ko directly contact kar sakta hoon?',
                answer: 'Product page par "Seller Info" mein seller details milte hain. Directly contact ka option limited hai — all issues helpdesk se faster resolve hote hain.'
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
                question: 'Jaipurio ka naam lekar fraud call aaya — kya karoon?',
                answer: 'Jaipurio kabhI OTP, bank details ya password phone par nahi maangta. Aise calls ko ignore karein, number block karein, aur Cyber Crime helpline 1930 par report karein.'
            },
            {
                question: 'Mera account hack ho gaya — immediately kya karoon?',
                answer: '1. Turant password change karein | 2. Registered email se ek aur device se login karein | 3. "Contact Support" pe "Account Compromised" report karein | 4. Bank ko inform karein agar payment details save thein.'
            },
            {
                question: 'Suspicious transaction dikha account mein',
                answer: '"My Orders" mein suspicious order dekh rahe hain? Turant "Report Unauthorized Transaction" karein. Order delivery se pehle cancel ho sakta hai aur full refund milega.'
            },
            {
                question: 'Fake Jaipurio website/app — kaise pehchanen?',
                answer: 'Official app sirf Google Play Store aur Apple App Store se download karein. Website URL check karein — sirf official domain. Kisi bhi third-party site par login maat karein.'
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
                question: 'Jaipurio Coins kaise earn karein?',
                answer: 'Har successful delivery par coins milte hain. Reviews likhne par, referrals par, aur special events par bonus coins milte hain. "My Rewards" section mein track karein.'
            },
            {
                question: 'Coins redeem kaise karein?',
                answer: 'Checkout par "Use Jaipurio Coins" option select karein. 1 Coin = ₹1 discount. Minimum 50 coins use kar sakte hain ek order mein.'
            },
            {
                question: 'Coins expire kab hote hain?',
                answer: 'Earned coins 1 year tak valid hain from date of earning. Expiry date "My Rewards" section mein check kar sakte hain.'
            },
            {
                question: 'Rewards ke kya-kya benefits hain?',
                answer: 'Jaipurio Rewards se milta hai: Free delivery on select orders | Priority customer support | Early access to sales | Special birthday discounts | Higher coin earning rate.'
            }
        ]
    }
];

const defaultHelpCenterConfig = {
    pageTitle: 'Help Center',
    pageSubtitle: 'Hum aapki madad ke liye hamesha taiyaar hain',
    searchPlaceholderDesktop: 'Kisi bhi topic ke baare mein search karein...',
    searchPlaceholderMobile: 'Apni problem type karein...',
    categories: []
};

const normalizeConfig = (value) => {
    if (!value || typeof value !== 'object') return defaultHelpCenterConfig;

    const rawCategories = Array.isArray(value.categories) ? value.categories : [];
    const normalizedCategories = rawCategories
        .map((cat, catIdx) => ({
            id: cat?.id || `cat-${catIdx + 1}`,
            title: cat?.title || `Category ${catIdx + 1}`,
            icon: cat?.icon || 'help',
            desc: cat?.desc || '',
            faqs: (Array.isArray(cat?.faqs) ? cat.faqs : [])
                .map((faq, faqIdx) => ({
                    question: String(faq?.question || '').trim(),
                    answer: String(faq?.answer || '').trim(),
                    id: faq?.id || `${cat?.id || `cat-${catIdx + 1}`}-faq-${faqIdx + 1}`
                }))
                .filter((faq) => faq.question || faq.answer)
        }))
        .filter((cat) => cat.title || cat.faqs.length > 0);

    return {
        pageTitle: value.pageTitle || defaultHelpCenterConfig.pageTitle,
        pageSubtitle: value.pageSubtitle || defaultHelpCenterConfig.pageSubtitle,
        searchPlaceholderDesktop: value.searchPlaceholderDesktop || value.searchPlaceholder || defaultHelpCenterConfig.searchPlaceholderDesktop,
        searchPlaceholderMobile: value.searchPlaceholderMobile || defaultHelpCenterConfig.searchPlaceholderMobile,
        categories: normalizedCategories
    };
};

const HelpCenter = ({ embeddedInInfo = false }) => {
    const navigate = useNavigate();
    const [config, setConfig] = useState(defaultHelpCenterConfig);
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const helpData = config.categories;
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');
    const [expandedFaq, setExpandedFaq] = useState(null);
    const [showContactForm, setShowContactForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        const fetchHelpCenterConfig = async () => {
            try {
                const { data } = await API.get(`/pages/${HELP_CENTER_CONFIG_KEY}`);
                if (data?.content) {
                    const parsed = JSON.parse(data.content);
                    setConfig(normalizeConfig(parsed));
                }
            } catch (error) {
                // Keep empty state if config is unavailable.
            } finally {
                setIsConfigLoading(false);
            }
        };

        fetchHelpCenterConfig();
    }, []);

    const handleFormSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSubmitted(true);
            setTimeout(() => {
                setIsSubmitted(false);
                setShowContactForm(false);
            }, 3000);
        }, 2000);
    };

    const toggleFaq = (id) => {
        setExpandedFaq(expandedFaq === id ? null : id);
    };

    const getFilledFaqs = (category) => (
        Array.isArray(category?.faqs)
            ? category.faqs.filter((faq) => String(faq?.question || '').trim() || String(faq?.answer || '').trim())
            : []
    );

    const filteredFaqs = useMemo(() => {
        let result = [];
        const query = searchQuery.trim().toLowerCase();

        const categoriesToSearch = activeCategory === 'all'
            ? helpData
            : helpData.filter(c => c.id === activeCategory);

        categoriesToSearch.forEach(category => {
            getFilledFaqs(category).forEach((faq, faqIdx) => {
                const matchesSearch = !query ||
                    faq.question.toLowerCase().includes(query) ||
                    faq.answer.toLowerCase().includes(query);
                if (matchesSearch) {
                    result.push({
                        ...faq,
                        categoryTitle: category.title,
                        categoryIcon: category.icon,
                        id: `${category.id}-${faqIdx}`
                    });
                }
            });
        });

        return result;
    }, [searchQuery, activeCategory, helpData]);

    const getCategoryCount = (catId) => {
        const category = helpData.find(c => c.id === catId);
        return getFilledFaqs(category).length;
    };

    return (
        <div className={`bg-[#f1f3f6] min-h-screen pb-16 ${embeddedInInfo ? 'pt-2 md:pt-3' : ''}`}>

            {/* ── Mobile Header ── */}
            <div className="bg-[#2874f0] px-4 pt-0 pb-4 sticky top-0 z-10 md:hidden">
                <div className="flex items-center gap-4 text-white mb-3 pt-3">
                    <button onClick={() => navigate(-1)} className="material-icons">arrow_back</button>
                    <h1 className="text-lg font-bold">{config.pageTitle}</h1>
                </div>
                <div className="bg-white rounded-md flex items-center px-3 py-2.5 shadow-lg">
                    <span className="material-icons text-gray-400 mr-2 text-xl">search</span>
                    <input
                        type="text"
                        placeholder={config.searchPlaceholderMobile}
                        className="flex-1 outline-none text-sm text-gray-900"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setExpandedFaq(null); }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="material-icons text-gray-400 text-lg">close</button>
                    )}
                </div>
            </div>

            {/* ── Desktop Container ── */}
            <div className="md:max-w-5xl md:mx-auto md:px-4 md:pt-0">

                {/* Desktop Title & Search */}
                <div className="hidden md:flex items-center justify-between mb-6">
                    <div className="flex items-start gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="mt-1 p-1.5 rounded-full text-gray-500 hover:text-[#2874f0] hover:bg-primary-50 transition-colors"
                            aria-label="Go back"
                        >
                            <span className="material-icons text-[20px]">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">{config.pageTitle}</h1>
                            <p className="text-sm text-gray-500 mt-1">{config.pageSubtitle}</p>
                        </div>
                    </div>
                    <div className="relative w-96">
                        <span className="material-icons absolute left-3 top-2.5 text-gray-400 text-xl">search</span>
                        <input
                            type="text"
                            placeholder={config.searchPlaceholderDesktop}
                            className="w-full pl-10 pr-9 py-2.5 border border-gray-300 rounded-sm focus:border-[#2874f0] outline-none text-sm text-gray-900"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setExpandedFaq(null); }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="material-icons absolute right-3 top-2.5 text-gray-400 text-lg">close</button>
                        )}
                    </div>
                </div>

                <div className="px-3 md:px-0 space-y-4 md:space-y-5">

                    {/* ── Category Tiles ── */}
                    <div className="grid grid-cols-4 gap-2 md:gap-3">
                        {helpData.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(activeCategory === cat.id ? 'all' : cat.id);
                                    setSearchQuery('');
                                    setExpandedFaq(null);
                                }}
                                className={`rounded-lg border p-3 text-center transition-all active:scale-95 md:py-5 md:rounded-md
                                    ${activeCategory === cat.id
                                        ? 'bg-[#2874f0] border-[#2874f0] shadow-md shadow-primary-200'
                                        : 'bg-white border-gray-100 hover:border-[#2874f0] hover:shadow-sm'}`}
                            >
                                <span className={`material-icons text-2xl mb-1 md:text-3xl md:mb-2 ${activeCategory === cat.id ? 'text-white' : 'text-[#2874f0]'}`}>
                                    {cat.icon}
                                </span>
                                <p className={`text-[10px] font-bold leading-tight md:text-xs ${activeCategory === cat.id ? 'text-white' : 'text-gray-700'}`}>
                                    {cat.title}
                                </p>
                                <p className={`text-[9px] mt-0.5 hidden md:block ${activeCategory === cat.id ? 'text-primary-100' : 'text-gray-400'}`}>
                                    {getCategoryCount(cat.id)} topics
                                </p>
                            </button>
                        ))}
                    </div>

                    {/* ── Category Filter Pills (mobile horizontal scroll) ── */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide md:hidden">
                        <button
                            onClick={() => { setActiveCategory('all'); setSearchQuery(''); setExpandedFaq(null); }}
                            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all
                                ${activeCategory === 'all' ? 'bg-[#2874f0] text-white border-[#2874f0]' : 'bg-white text-gray-600 border-gray-200'}`}
                        >
                            All Topics
                        </button>
                        {helpData.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => { setActiveCategory(cat.id); setSearchQuery(''); setExpandedFaq(null); }}
                                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all
                                    ${activeCategory === cat.id ? 'bg-[#2874f0] text-white border-[#2874f0]' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                {cat.title}
                            </button>
                        ))}
                    </div>

                    {/* ── Desktop tab filter ── */}
                    <div className="hidden md:flex gap-2 flex-wrap">
                        <button
                            onClick={() => { setActiveCategory('all'); setSearchQuery(''); setExpandedFaq(null); }}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all
                                ${activeCategory === 'all' ? 'bg-[#2874f0] text-white border-[#2874f0]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#2874f0]'}`}
                        >
                            All Topics
                        </button>
                        {helpData.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => { setActiveCategory(cat.id); setSearchQuery(''); setExpandedFaq(null); }}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all
                                    ${activeCategory === cat.id ? 'bg-[#2874f0] text-white border-[#2874f0]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#2874f0]'}`}
                            >
                                {cat.title}
                            </button>
                        ))}
                    </div>

                    {/* ── Main Content Grid ── */}
                    <div className="md:grid md:grid-cols-3 md:gap-5 md:items-start">

                        {/* FAQ Accordion — left 2/3 */}
                        <div className="md:col-span-2">
                            {/* Section heading */}
                            <div className="flex items-center justify-between mb-2 md:mb-3">
                                <h2 className="text-sm font-bold text-gray-700 md:text-base">
                                    {searchQuery
                                        ? `"${searchQuery}" ke results`
                                        : activeCategory === 'all'
                                            ? 'Popular Topics'
                                            : helpData.find(c => c.id === activeCategory)?.title}
                                </h2>
                                <span className="text-xs text-gray-400">{filteredFaqs.length} topics</span>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden md:rounded-md shadow-sm">
                                {isConfigLoading ? (
                                    <div className="py-12 text-center">
                                        <div className="w-8 h-8 mx-auto border-2 border-primary-100 border-t-[#2874f0] rounded-full animate-spin"></div>
                                        <p className="text-sm text-gray-500 mt-3">Topics load ho rahe hain...</p>
                                    </div>
                                ) : filteredFaqs.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <span className="material-icons text-4xl text-gray-300 mb-2">search_off</span>
                                        <p className="text-sm text-gray-500">Koi result nahi mila</p>
                                        <button
                                            onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                                            className="mt-3 text-xs text-[#2874f0] font-semibold"
                                        >
                                            Sab topics dekhein
                                        </button>
                                    </div>
                                ) : (
                                    filteredFaqs.map((faq) => (
                                        <div key={faq.id} className="border-b border-gray-50 last:border-0">
                                            <button
                                                onClick={() => toggleFaq(faq.id)}
                                                className="w-full text-left px-4 py-4 flex items-start justify-between gap-3 hover:bg-gray-50 transition-colors outline-none md:px-5"
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    {/* Category badge when showing All */}
                                                    {(activeCategory === 'all' || searchQuery) && (
                                                        <span className={`material-icons text-[#2874f0] text-lg mt-0.5 flex-shrink-0`}>
                                                            {faq.categoryIcon}
                                                        </span>
                                                    )}
                                                    <span className={`text-sm font-medium leading-snug transition-colors ${expandedFaq === faq.id ? 'text-[#2874f0]' : 'text-gray-700'}`}>
                                                        {faq.question}
                                                    </span>
                                                </div>
                                                <span className={`material-icons text-gray-400 text-lg flex-shrink-0 mt-0.5 transition-transform duration-300 ${expandedFaq === faq.id ? 'rotate-180 !text-[#2874f0]' : ''}`}>
                                                    expand_more
                                                </span>
                                            </button>

                                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedFaq === faq.id ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                                <div className={`px-4 pb-4 md:px-5 md:pb-5 ${(activeCategory === 'all' || searchQuery) ? 'pl-12 md:pl-14' : ''}`}>
                                                    <p className="text-xs text-gray-500 leading-relaxed md:text-sm">{faq.answer}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Right Sidebar */}
                        <div className="mt-4 md:mt-0 space-y-3">


                            {/* Quick Links */}
                            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm md:rounded-md">
                                <div className="px-4 py-3 border-b border-gray-50">
                                    <h4 className="text-sm font-bold text-gray-700">Quick Links</h4>
                                </div>
                                {[
                                    { icon: 'inventory_2', label: 'My Orders', path: '/orders' },
                                    { icon: 'assignment_return', label: 'Returns & Refunds', path: '/orders' },
                                    { icon: 'location_on', label: 'Saved Addresses', path: '/addresses' },
                                    { icon: 'account_circle', label: 'My Profile', path: '/account' },
                                ].map((link, i) => (
                                    <button
                                        key={i}
                                        onClick={() => navigate(link.path)}
                                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors text-left"
                                    >
                                        <span className="material-icons text-[#2874f0] text-lg">{link.icon}</span>
                                        <span className="text-sm text-gray-600 font-medium">{link.label}</span>
                                        <span className="material-icons text-gray-300 text-base ml-auto">chevron_right</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Contact Support Modal ── */}
            {showContactForm && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !isSubmitting && setShowContactForm(false)}
                    />
                    <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
                        {isSubmitted ? (
                            <div className="p-10 text-center">
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-5">
                                    <span className="material-icons text-4xl">check_circle</span>
                                </div>
                                <h2 className="text-2xl font-black text-gray-800 mb-2">Request Received!</h2>
                                <p className="text-gray-500 text-sm">Hamare support team 24 hours mein aapse contact karegi.</p>
                            </div>
                        ) : (
                            <>
                                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-800">Support Request</h3>
                                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                                            Help ID: #RT{Math.floor(Math.random() * 9000) + 1000}
                                        </p>
                                    </div>
                                    <button onClick={() => setShowContactForm(false)} className="material-icons text-gray-400 hover:text-gray-600">close</button>
                                </div>

                                <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Issue Category</label>
                                        <select required className="w-full border border-gray-200 p-3 rounded-lg text-sm bg-gray-50 focus:border-[#2874f0] outline-none text-gray-900">
                                            <option value="">Category select karein</option>
                                            <option>Order Delay</option>
                                            <option>Damaged Product</option>
                                            <option>Payment / Refund Issue</option>
                                            <option>Account Security</option>
                                            <option>Wrong Item Delivered</option>
                                            <option>Offers & Coupons</option>
                                            <option>Others</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name</label>
                                        <input required type="text" placeholder="Aapka naam" className="w-full border border-gray-200 p-3 rounded-lg text-sm focus:border-[#2874f0] outline-none text-gray-900" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Mobile / Email</label>
                                        <input required type="text" placeholder="Contact detail" className="w-full border border-gray-200 p-3 rounded-lg text-sm focus:border-[#2874f0] outline-none text-gray-900" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Problem Describe Karein</label>
                                        <textarea required rows={4} placeholder="Jitna detail mein bata sakein, utna better..." className="w-full border border-gray-200 p-3 rounded-lg text-sm focus:border-[#2874f0] outline-none text-gray-900" />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`w-full py-3.5 rounded-xl font-black uppercase text-sm shadow-lg transition-all flex items-center justify-center gap-2
                                            ${isSubmitting ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-[#fb641b] text-white active:scale-95'}`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Bhej rahe hain...
                                            </>
                                        ) : 'Submit Request'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpCenter;
