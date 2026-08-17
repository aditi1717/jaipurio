import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import useSettingsStore from '../../store/settingsStore';

const ShippingCharges = () => {
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        shippingCharge: 40,
        minShippingOrderAmount: 0,
        maxShippingOrderAmount: 499
    });
    const settings = useSettingsStore((state) => state.settings);
    const loading = useSettingsStore((state) => state.isLoading);
    const fetchSettings = useSettingsStore((state) => state.fetchSettings);
    const updateSettings = useSettingsStore((state) => state.updateSettings);

    useEffect(() => {
        fetchSettings().catch((error) => {
            console.error('Failed to fetch shipping settings:', error);
            toast.error('Failed to load shipping settings');
        });
    }, [fetchSettings]);

    useEffect(() => {
        if (!settings) return;
        const fallbackMax = Number(settings?.freeShippingThreshold ?? 500) - 1;
        setForm({
            shippingCharge: Number(settings?.shippingCharge ?? 40),
            minShippingOrderAmount: Number(settings?.minShippingOrderAmount ?? 0),
            maxShippingOrderAmount: Number(settings?.maxShippingOrderAmount ?? (fallbackMax >= 0 ? fallbackMax : 499))
        });
    }, [settings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: value === '' ? '' : Number(value)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const shippingCharge = Number(form.shippingCharge);
        const minShippingOrderAmount = Number(form.minShippingOrderAmount);
        const maxShippingOrderAmount = Number(form.maxShippingOrderAmount);

        if (!Number.isFinite(shippingCharge) || shippingCharge < 0) {
            toast.error('Shipping charge must be 0 or more');
            return;
        }
        if (!Number.isFinite(minShippingOrderAmount) || minShippingOrderAmount < 0) {
            toast.error('Min order amount must be 0 or more');
            return;
        }
        if (!Number.isFinite(maxShippingOrderAmount) || maxShippingOrderAmount < 0) {
            toast.error('Max order amount must be 0 or more');
            return;
        }
        if (maxShippingOrderAmount < minShippingOrderAmount) {
            toast.error('Max order amount must be greater than or equal to min amount');
            return;
        }

        setSaving(true);
        try {
            const data = new FormData();
            data.append('shippingCharge', String(shippingCharge));
            data.append('minShippingOrderAmount', String(minShippingOrderAmount));
            data.append('maxShippingOrderAmount', String(maxShippingOrderAmount));

            const res = await updateSettings(data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setForm({
                shippingCharge: Number(res?.shippingCharge ?? shippingCharge),
                minShippingOrderAmount: Number(res?.minShippingOrderAmount ?? minShippingOrderAmount),
                maxShippingOrderAmount: Number(res?.maxShippingOrderAmount ?? maxShippingOrderAmount)
            });
            toast.success('Shipping charges updated');
        } catch (error) {
            console.error('Failed to update shipping settings:', error);
            toast.error(error.response?.data?.message || 'Failed to update shipping charges');
        } finally {
            setSaving(false);
        }
    };

    if (loading && !settings) {
        return <div className="p-8 text-center text-gray-500 font-medium">Loading shipping charges...</div>;
    }

    return (
        <div className="p-6 md:p-8 bg-gray-50 min-h-screen">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight">Shipping Charges</h1>
            <p className="text-gray-500 mb-8 font-medium">Set delivery charge rules used in cart and checkout.</p>

            <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl space-y-6">
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">
                        Shipping Charge (INR)
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        name="shippingCharge"
                        value={form.shippingCharge}
                        onChange={handleChange}
                        className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-medium text-gray-900 bg-gray-50/50 transition-all"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">
                        Min Order Amount For Shipping (INR)
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        name="minShippingOrderAmount"
                        value={form.minShippingOrderAmount}
                        onChange={handleChange}
                        className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-medium text-gray-900 bg-gray-50/50 transition-all"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2 tracking-wider">
                        Max Order Amount For Shipping (INR)
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        name="maxShippingOrderAmount"
                        value={form.maxShippingOrderAmount}
                        onChange={handleChange}
                        className="w-full border border-gray-200 rounded-xl p-3.5 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-medium text-gray-900 bg-gray-50/50 transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Shipping charge will apply only when cart total is between min and max range. Outside this range, shipping is free.
                    </p>
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${saving ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                    >
                        {saving ? 'Saving...' : 'Save Shipping Charges'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ShippingCharges;
