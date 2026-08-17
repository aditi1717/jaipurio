import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import useSettingsStore from '../../store/settingsStore';

const createEditableSettings = (settingsData = {}) => ({
    sellerName: settingsData.sellerName || '',
    sellerAddress: settingsData.sellerAddress || '',
    gstNumber: settingsData.gstNumber || '',
    panNumber: settingsData.panNumber || '',
    logoUrl: settingsData.logoUrl || '',
    signatureUrl: settingsData.signatureUrl || '',
    contactEmail: settingsData.contactEmail || '',
    contactPhone: settingsData.contactPhone || ''
});

const SettingsForm = ({ initialSettings, updateSettings }) => {
    const [settings, setSettings] = useState(() => createEditableSettings(initialSettings));
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(() => initialSettings.logoUrl || '');
    const [signatureFile, setSignatureFile] = useState(null);
    const [signaturePreview, setSignaturePreview] = useState(() => initialSettings.signatureUrl || '');

    useEffect(() => () => {
        if (logoPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(logoPreview);
        }
        if (signaturePreview?.startsWith('blob:')) {
            URL.revokeObjectURL(signaturePreview);
        }
    }, [logoPreview, signaturePreview]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);
        if (field === 'logo') {
            if (logoPreview?.startsWith('blob:')) {
                URL.revokeObjectURL(logoPreview);
            }
            setLogoFile(file);
            setLogoPreview(previewUrl);
        } else if (field === 'signature') {
            if (signaturePreview?.startsWith('blob:')) {
                URL.revokeObjectURL(signaturePreview);
            }
            setSignatureFile(file);
            setSignaturePreview(previewUrl);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();

        formData.append('sellerName', settings.sellerName);
        formData.append('sellerAddress', settings.sellerAddress);
        formData.append('gstNumber', settings.gstNumber);
        formData.append('panNumber', settings.panNumber);
        formData.append('contactEmail', settings.contactEmail);
        formData.append('contactPhone', settings.contactPhone);
        formData.append('logoUrl', settings.logoUrl);
        formData.append('signatureUrl', settings.signatureUrl);

        if (logoFile) {
            formData.append('logo', logoFile);
        }
        if (signatureFile) {
            formData.append('signature', signatureFile);
        }

        try {
            await updateSettings(formData);
            setLogoFile(null);
            setSignatureFile(null);
            toast.success('Settings updated successfully');
        } catch (error) {
            console.error('Error updating settings:', error);
            toast.error(error.response?.data?.message || 'Failed to update settings');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest border-b pb-2">Business Details</h2>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">Seller / Store Name</label>
                        <input
                            type="text"
                            name="sellerName"
                            value={settings.sellerName}
                            onChange={handleChange}
                            className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none placeholder:text-gray-500 caret-black font-medium text-gray-900 bg-gray-50/50 transition-all"
                            placeholder="Enter store name"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">GST Number</label>
                        <input
                            type="text"
                            name="gstNumber"
                            value={settings.gstNumber}
                            onChange={handleChange}
                            className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none placeholder:text-gray-500 caret-black font-medium text-gray-900 bg-gray-50/50 transition-all"
                            placeholder="GSTIN"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">PAN Number</label>
                        <input
                            type="text"
                            name="panNumber"
                            value={settings.panNumber}
                            onChange={handleChange}
                            className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none placeholder:text-gray-500 caret-black font-medium text-gray-900 bg-gray-50/50 transition-all"
                            placeholder="PAN"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">Business Address</label>
                        <textarea
                            name="sellerAddress"
                            value={settings.sellerAddress}
                            onChange={handleChange}
                            rows="4"
                            className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none placeholder:text-gray-500 caret-black font-medium text-gray-900 bg-gray-50/50 transition-all resize-none"
                            placeholder="Full registered address"
                        ></textarea>
                    </div>
                </div>

                <div className="space-y-6">
                    <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest border-b pb-2">Contact & Brand Identity</h2>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">Support Email</label>
                        <input
                            type="email"
                            name="contactEmail"
                            value={settings.contactEmail}
                            onChange={handleChange}
                            className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none placeholder:text-gray-500 caret-black font-medium text-gray-900 bg-gray-50/50 transition-all"
                            placeholder="support@yourstore.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">Official Logo</label>
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <div className="w-20 h-20 bg-white rounded-lg border flex items-center justify-center overflow-hidden flex-shrink-0">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-2xl text-gray-300 font-black">?</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <input
                                    type="file"
                                    id="logoInput"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, 'logo')}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="logoInput"
                                    className="inline-block px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    CHOOSE FILE
                                </label>
                                <p className="mt-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-tight">JPG, PNG OR WEBP. MAX 2MB.</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">Authorized Signature</label>
                        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            <div className="w-20 h-20 bg-white rounded-lg border flex items-center justify-center overflow-hidden flex-shrink-0">
                                {signaturePreview ? (
                                    <img src={signaturePreview} alt="Signature" className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-2xl text-gray-300 font-black">?</span>
                                )}
                            </div>
                            <div className="flex-1">
                                <input
                                    type="file"
                                    id="sigInput"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, 'signature')}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="sigInput"
                                    className="inline-block px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-black text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
                                >
                                    CHOOSE FILE
                                </label>
                                <p className="mt-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-tight">Used for automated invoice signing</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-10 pt-8 border-t border-gray-100 flex justify-end">
                <button
                    type="submit"
                    className="bg-primary-600 text-white font-black text-xs uppercase tracking-widest py-4 px-12 rounded-xl hover:bg-black transition-all shadow-xl shadow-primary-500/20 active:scale-95"
                >
                    Synchronize Settings
                </button>
            </div>
        </form>
    );
};

const SettingsPage = () => {
    const settingsData = useSettingsStore((state) => state.settings);
    const loading = useSettingsStore((state) => state.isLoading);
    const fetchSettings = useSettingsStore((state) => state.fetchSettings);
    const updateSettings = useSettingsStore((state) => state.updateSettings);

    useEffect(() => {
        fetchSettings().catch((error) => {
            console.error('Error fetching settings:', error);
            toast.error('Failed to load settings');
        });
    }, [fetchSettings]);

    if (loading && !settingsData) {
        return <div className="p-8 text-center text-gray-500 font-medium">Loading settings...</div>;
    }

    return (
        <div className="p-8 bg-gray-50 min-h-screen font-sans">
            <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Store Settings</h1>
            <p className="text-gray-500 mb-8 font-medium italic">Configure your business details and invoice visuals</p>
            {settingsData ? (
                <SettingsForm
                    key={[settingsData.logoUrl || '', settingsData.signatureUrl || '', settingsData.contactEmail || ''].join('|')}
                    initialSettings={settingsData}
                    updateSettings={updateSettings}
                />
            ) : null}
        </div>
    );
};

export default SettingsPage;
