import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MdPayment, MdInfoOutline, MdCheckCircle, MdSecurity } from 'react-icons/md';
import useSettingsStore from '../../store/settingsStore';

const CODAdvancedPayment = () => {
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        codAdvancedPaymentEnabled: false,
        codAdvancedPaymentAmount: 0
    });
    const settings = useSettingsStore((state) => state.settings);
    const loading = useSettingsStore((state) => state.isLoading);
    const fetchSettings = useSettingsStore((state) => state.fetchSettings);
    const updateSettings = useSettingsStore((state) => state.updateSettings);

    useEffect(() => {
        fetchSettings().catch((error) => {
            console.error('Failed to fetch COD advanced payment settings:', error);
            toast.error('Failed to load configuration');
        });
    }, [fetchSettings]);

    useEffect(() => {
        if (!settings) return;
        setForm({
            codAdvancedPaymentEnabled: !!settings?.codAdvancedPaymentEnabled,
            codAdvancedPaymentAmount: Number(settings?.codAdvancedPaymentAmount ?? 0)
        });
    }, [settings]);

    const handleToggle = () => {
        setForm((prev) => ({
            ...prev,
            codAdvancedPaymentEnabled: !prev.codAdvancedPaymentEnabled
        }));
    };

    const handleAmountChange = (e) => {
        const { value } = e.target;
        setForm((prev) => ({
            ...prev,
            codAdvancedPaymentAmount: value === '' ? '' : Number(value)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const amount = Number(form.codAdvancedPaymentAmount);

        if (form.codAdvancedPaymentEnabled && (!Number.isFinite(amount) || amount <= 0)) {
            toast.error('Please enter a valid advanced payment amount greater than 0');
            return;
        }

        if (amount < 0) {
            toast.error('Amount cannot be negative');
            return;
        }

        setSaving(true);
        try {
            const data = new FormData();
            data.append('codAdvancedPaymentEnabled', String(form.codAdvancedPaymentEnabled));
            data.append('codAdvancedPaymentAmount', String(amount));

            const res = await updateSettings(data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setForm({
                codAdvancedPaymentEnabled: !!res?.codAdvancedPaymentEnabled,
                codAdvancedPaymentAmount: Number(res?.codAdvancedPaymentAmount ?? amount)
            });
            toast.success('COD Advanced Payment settings updated successfully');
        } catch (error) {
            console.error('Failed to update COD settings:', error);
            toast.error(error.response?.data?.message || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading && !settings) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50/50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
                    <p className="text-sm font-semibold text-gray-500">Loading configurations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] p-4 md:p-8">
            <div className="mx-auto max-w-4xl">
                {/* Premium Header */}
                <div className="mb-8 rounded-3xl border border-white/80 bg-white/60 p-6 shadow-xl shadow-slate-100/50 backdrop-blur md:p-8">
                    <div className="flex items-center gap-4">
                        <div className="inline-flex rounded-2xl bg-amber-500/10 p-3.5 text-amber-600 shadow-inner">
                            <MdPayment size={32} />
                        </div>
                        <div>
                            <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">
                                COD Security Module
                            </div>
                            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                                Cash on Delivery Advanced Payment
                            </h1>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                                Minimize COD RTO (Return to Origin) risks by requiring customers to complete a customizable partial online pre-payment prior to confirmation.
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Settings Panel */}
                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
                        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-6">
                            <div>
                                <h2 className="text-lg font-black text-slate-800">Advanced Pre-Payment Requirement</h2>
                                <p className="text-sm font-medium text-slate-500 mt-1 max-w-lg">
                                    When enabled, users choosing Cash on Delivery must pay a customizable partial amount online via Razorpay before their order can be finalized.
                                </p>
                            </div>
                            {/* Premium Slide Switch */}
                            <button
                                type="button"
                                onClick={handleToggle}
                                className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none focus:ring-2 focus:ring-amber-500/20 ${form.codAdvancedPaymentEnabled ? 'bg-amber-500' : 'bg-slate-200'}`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.codAdvancedPaymentEnabled ? 'translate-x-8' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>

                        {/* Collapsible Input Fields when Enabled */}
                        <div className={`transition-all duration-300 overflow-hidden ${form.codAdvancedPaymentEnabled ? 'max-h-[500px] opacity-100 mt-6' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                            <div className="rounded-2xl bg-slate-50 p-6 border border-slate-100 space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2.5 tracking-wider">
                                        Advanced Pre-Payment Amount (INR)
                                    </label>
                                    <div className="relative rounded-xl shadow-sm max-w-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                            <span className="text-gray-500 font-bold text-sm">₹</span>
                                        </div>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={form.codAdvancedPaymentAmount}
                                            onChange={handleAmountChange}
                                            placeholder="Enter pre-payment amount"
                                            className="block w-full border border-gray-200 rounded-xl py-3.5 pl-9 pr-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none font-bold text-slate-900 bg-white transition-all text-lg"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        This exact amount will be captured online. The collectable COD amount at delivery is automatically reduced by this value.
                                    </p>
                                </div>

                                {/* Flow Explanation */}
                                <div className="border-t border-slate-200/60 pt-4">
                                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3">Expected Customer Flow</h4>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="flex items-start gap-2.5">
                                            <div className="text-amber-500 mt-0.5 shrink-0"><MdCheckCircle size={16} /></div>
                                            <div className="text-xs font-medium text-slate-600">Selects COD payment option during the standard checkout.</div>
                                        </div>
                                        <div className="flex items-start gap-2.5">
                                            <div className="text-amber-500 mt-0.5 shrink-0"><MdCheckCircle size={16} /></div>
                                            <div className="text-xs font-medium text-slate-600">Razorpay modal launches to collect pre-payment of ₹{form.codAdvancedPaymentAmount || 0} online.</div>
                                        </div>
                                        <div className="flex items-start gap-2.5">
                                            <div className="text-amber-500 mt-0.5 shrink-0"><MdCheckCircle size={16} /></div>
                                            <div className="text-xs font-medium text-slate-600">Order gets placed with the remaining balance due as Cash on Delivery.</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Informational Guidelines Card */}
                        <div className="mt-6 flex gap-4 rounded-2xl border border-amber-200/50 bg-amber-50/40 p-5">
                            <div className="text-amber-600 shrink-0 mt-0.5">
                                <MdInfoOutline size={20} />
                            </div>
                            <div className="text-xs font-medium leading-relaxed text-amber-800">
                                <span className="font-bold">Pro-tip for COD Orders:</span> In India, COD orders suffer from high RTO rates, reaching up to 30%. Requiring a micro pre-payment (e.g., ₹100 or ₹150) establishes strong customer intent and ensures delivery courier costs are offset in case of rejection, drastically lowering operational losses.
                            </div>
                        </div>
                    </div>

                    {/* Bottom Save Trigger Panel */}
                    <div className="sticky bottom-4 z-20 flex justify-end">
                        <div className="flex items-center gap-4 rounded-full border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-200/50 backdrop-blur">
                            <div className="hidden text-right md:block">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                                    Configuration Module
                                </div>
                                <div className="text-sm font-bold text-slate-900">
                                    Save current setting values
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className={`rounded-full px-8 py-3 text-xs font-black uppercase tracking-[0.22em] transition-all flex items-center gap-2 ${saving ? 'cursor-not-allowed bg-slate-300 text-slate-600' : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-md shadow-slate-950/15'}`}
                            >
                                <MdSecurity size={16} />
                                {saving ? 'Syncing...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CODAdvancedPayment;
