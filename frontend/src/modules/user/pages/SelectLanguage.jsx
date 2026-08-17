import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';

const languages = [
    { name: 'English', native: 'English' },
    { name: 'Hindi', native: 'हिन्दी' },
    { name: 'Marathi', native: 'मराठी' },
    { name: 'Telugu', native: 'తెలుగు' },
    { name: 'Tamil', native: 'தமிழ்' },
    { name: 'Kannada', native: 'ಕನ್ನಡ' },
    { name: 'Gujarati', native: 'ગુજરાતી' },
    { name: 'Bengali', native: 'বাংলা' }
];

const SelectLanguage = () => {
    const navigate = useNavigate();
    const { language, setLanguage } = useCartStore();

    const handleSelect = (lang) => {
        setLanguage(lang);
        setTimeout(() => {
            navigate('/account');
        }, 300);
    };

    return (
        <div className="bg-white min-h-screen md:bg-[#f1f3f6] md:py-10">
            {/* Mobile Header */}
            <div className="bg-white px-4 py-4 flex items-center gap-4 border-b sticky top-0 z-10 md:hidden">
                <button onClick={() => navigate(-1)} className="material-icons text-gray-700">arrow_back</button>
                <h1 className="text-lg font-bold text-gray-800">Select Language</h1>
            </div>

            {/* Desktop Container */}
            <div className="md:max-w-[800px] md:mx-auto md:bg-white md:p-8 md:rounded-lg md:shadow-sm relative">

                {/* Desktop Back Button */}
                <button
                    onClick={() => navigate(-1)}
                    className="hidden md:flex absolute top-8 left-8 items-center gap-1 text-gray-500 hover:text-primary-600 transition-colors"
                >
                    <span className="material-icons text-lg">arrow_back</span>
                    <span className="text-xs font-bold uppercase">Back</span>
                </button>

                <h1 className="hidden md:block text-2xl font-bold text-gray-800 mb-2 text-center">Select Language</h1>
                <p className="hidden md:block text-sm text-gray-500 text-center mb-10">Choose your preferred language for surfing</p>

                <div className="p-4 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6 md:p-0">
                    {languages.map((lang) => (
                        <button
                            key={lang.name}
                            onClick={() => handleSelect(lang.name)}
                            className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 group active:scale-95 md:h-32 md:hover:shadow-md ${language === lang.name
                                ? 'border-primary-600 bg-primary-50'
                                : 'border-gray-100 hover:border-primary-200'
                                }`}
                        >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${language === lang.name ? 'border-primary-600 bg-primary-600' : 'border-gray-300'
                                }`}>
                                {language === lang.name && <span className="material-icons text-white text-[16px]">check</span>}
                            </div>
                            <span className={`text-base font-bold ${language === lang.name ? 'text-primary-600' : 'text-gray-800'}`}>
                                {lang.native}
                            </span>
                            <span className={`text-xs ${language === lang.name ? 'text-primary-400' : 'text-gray-400'}`}>
                                {lang.name}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Desktop Continue Button (Optional if auto-redirect is nice, but explicit is good too) */}
                <div className="hidden md:flex justify-center mt-10">
                    <button
                        onClick={() => navigate('/account')}
                        className="bg-[#fb641b] text-white px-10 py-3 rounded-sm font-bold uppercase text-sm shadow-md hover:bg-[#e85d19] transition-colors"
                    >
                        Continue
                    </button>
                </div>
            </div>

            {/* Mobile Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 border-t bg-white md:hidden">
                <button
                    onClick={() => navigate('/account')}
                    className="w-full bg-[#fb641b] text-white py-4 rounded-sm font-black uppercase text-sm shadow-lg active:scale-[0.98] transition-all"
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

export default SelectLanguage;
