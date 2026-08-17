import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import useSettingsStore from '../../store/settingsStore';

const DEFAULT_FORM = {
    razorpayKeyId: '',
    razorpayKeySecret: '',
    deliveryApi: '',
    delhiveryClientName: '',
    delhiveryPickupLocation: '',
    delhiveryToken: '',
    ekartBaseUrl: '',
    ekartTrackingBaseUrl: '',
    ekartClientId: '',
    ekartClientName: '',
    ekartPickupLocation: '',
    ekartUsername: '',
    ekartPassword: '',
    ekartApiKey: '',
    ekartCreateShipmentPath: '/api/v1/package/create',
    ekartTrackingPath: '/api/v1/track/{id}',
    ekartCancelPath: '/api/v1/package/cancel'
};

const SECTION_STYLES = {
    razorpay: {
        accent: 'from-slate-900 via-slate-800 to-slate-700',
        pill: 'bg-slate-100 text-slate-700',
        border: 'border-slate-200',
        focus: 'focus:ring-slate-500/20 focus:border-slate-500',
        soft: 'bg-slate-50'
    },
    delhivery: {
        accent: 'from-primary-700 via-primary-600 to-cyan-500',
        pill: 'bg-primary-100 text-primary-700',
        border: 'border-primary-200',
        focus: 'focus:ring-primary-500/20 focus:border-primary-500',
        soft: 'bg-primary-50'
    },
    ekart: {
        accent: 'from-emerald-700 via-emerald-600 to-lime-500',
        pill: 'bg-emerald-100 text-emerald-700',
        border: 'border-emerald-200',
        focus: 'focus:ring-emerald-500/20 focus:border-emerald-500',
        soft: 'bg-emerald-50'
    }
};

const InputField = ({ label, hint, section, ...props }) => {
    const styles = SECTION_STYLES[section];

    return (
        <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">
                {label}
            </span>
            <input
                {...props}
                className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-sm font-medium text-gray-900 outline-none transition-all placeholder:text-gray-400 ${styles.border} ${styles.focus}`}
            />
            {hint ? (
                <span className="mt-2 block text-xs leading-relaxed text-gray-500">{hint}</span>
            ) : null}
        </label>
    );
};

const SectionCard = ({ id, eyebrow, title, description, activeSection, setActiveSection, children }) => {
    const styles = SECTION_STYLES[id];
    const isActive = activeSection === id;

    return (
        <section
            id={id}
            className={`overflow-hidden rounded-[28px] border bg-white shadow-sm transition-all ${isActive ? `${styles.border} shadow-lg shadow-black/5` : 'border-gray-200'}`}
        >
            <button
                type="button"
                onClick={() => setActiveSection(id)}
                className={`w-full bg-gradient-to-r px-6 py-6 text-left text-white md:px-8 ${styles.accent}`}
            >
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/70">{eyebrow}</div>
                        <h2 className="mt-2 text-2xl font-black tracking-tight">{title}</h2>
                        <p className="mt-2 max-w-2xl text-sm font-medium text-white/80">{description}</p>
                    </div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
                        {isActive ? 'Editing now' : 'Open section'}
                    </div>
                </div>
            </button>
            <div className="p-6 md:p-8">
                {children}
            </div>
        </section>
    );
};

const RazorpayCredentials = () => {
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState('razorpay');
    const [form, setForm] = useState(DEFAULT_FORM);
    const settings = useSettingsStore((state) => state.settings);
    const loading = useSettingsStore((state) => state.isLoading);
    const fetchSettings = useSettingsStore((state) => state.fetchSettings);
    const updateSettings = useSettingsStore((state) => state.updateSettings);

    useEffect(() => {
        fetchSettings().catch((error) => {
            console.error('Failed to fetch API credentials:', error);
            toast.error('Failed to load API credentials');
        });
    }, [fetchSettings]);

    useEffect(() => {
        if (!settings) return;
        setForm({
            razorpayKeyId: settings?.razorpayKeyId || '',
            razorpayKeySecret: '',
            deliveryApi: settings?.deliveryApi || 'https://track.delhivery.com',
            delhiveryClientName: settings?.delhiveryClientName || '',
            delhiveryPickupLocation: settings?.delhiveryPickupLocation || '',
            delhiveryToken: '',
            ekartBaseUrl: settings?.ekartBaseUrl || '',
            ekartTrackingBaseUrl: settings?.ekartTrackingBaseUrl || '',
            ekartClientId: settings?.ekartClientId || '',
            ekartClientName: settings?.ekartClientName || '',
            ekartPickupLocation: settings?.ekartPickupLocation || '',
            ekartUsername: settings?.ekartUsername || '',
            ekartPassword: '',
            ekartApiKey: '',
            ekartCreateShipmentPath: settings?.ekartCreateShipmentPath || '/api/v1/package/create',
            ekartTrackingPath: settings?.ekartTrackingPath || '/api/v1/track/{id}',
            ekartCancelPath: settings?.ekartCancelPath || '/api/v1/package/cancel'
        });
    }, [settings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const data = new FormData();
            data.append('razorpayKeyId', form.razorpayKeyId.trim());
            data.append('razorpayKeySecret', form.razorpayKeySecret);
            data.append('deliveryApi', form.deliveryApi.trim());
            data.append('delhiveryClientName', form.delhiveryClientName.trim());
            data.append('delhiveryPickupLocation', form.delhiveryPickupLocation.trim());
            data.append('delhiveryToken', form.delhiveryToken);
            data.append('ekartBaseUrl', form.ekartBaseUrl.trim());
            data.append('ekartTrackingBaseUrl', form.ekartTrackingBaseUrl.trim());
            data.append('ekartClientId', form.ekartClientId.trim());
            data.append('ekartClientName', form.ekartClientName.trim());
            data.append('ekartPickupLocation', form.ekartPickupLocation.trim());
            data.append('ekartUsername', form.ekartUsername.trim());
            data.append('ekartPassword', form.ekartPassword);
            data.append('ekartApiKey', form.ekartApiKey);
            data.append('ekartCreateShipmentPath', form.ekartCreateShipmentPath.trim());
            data.append('ekartTrackingPath', form.ekartTrackingPath.trim());
            data.append('ekartCancelPath', form.ekartCancelPath.trim());

            const res = await updateSettings(data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setForm({
                razorpayKeyId: res?.razorpayKeyId || '',
                razorpayKeySecret: '',
                deliveryApi: res?.deliveryApi || 'https://track.delhivery.com',
                delhiveryClientName: res?.delhiveryClientName || '',
                delhiveryPickupLocation: res?.delhiveryPickupLocation || '',
                delhiveryToken: '',
                ekartBaseUrl: res?.ekartBaseUrl || '',
                ekartTrackingBaseUrl: res?.ekartTrackingBaseUrl || '',
                ekartClientId: res?.ekartClientId || '',
                ekartClientName: res?.ekartClientName || '',
                ekartPickupLocation: res?.ekartPickupLocation || '',
                ekartUsername: res?.ekartUsername || '',
                ekartPassword: '',
                ekartApiKey: '',
                ekartCreateShipmentPath: res?.ekartCreateShipmentPath || '/api/v1/package/create',
                ekartTrackingPath: res?.ekartTrackingPath || '/api/v1/track/{id}',
                ekartCancelPath: res?.ekartCancelPath || '/api/v1/package/cancel'
            });
            toast.success('API credentials updated');
        } catch (error) {
            console.error('Failed to update API credentials:', error);
            toast.error(error.response?.data?.message || 'Failed to update API credentials');
        } finally {
            setSaving(false);
        }
    };

    const sectionStats = useMemo(() => ([
        {
            id: 'razorpay',
            title: 'Razorpay',
            subtitle: 'Payments',
            blurb: 'Checkout keys for online payment collection.'
        },
        {
            id: 'delhivery',
            title: 'Delhivery',
            subtitle: 'Courier API',
            blurb: 'Live shipment creation and tracking for Delhivery.'
        },
        {
            id: 'ekart',
            title: 'Ekart',
            subtitle: 'Courier API',
            blurb: 'Separate Ekart account endpoints and auth settings.'
        }
    ]), []);

    if (loading && !settings) {
        return <div className="p-8 text-center text-gray-500 font-medium">Loading API credentials...</div>;
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fb_0%,#eef4f7_100%)] p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
                <div className="rounded-[32px] border border-white/70 bg-white/70 p-6 shadow-xl shadow-slate-200/40 backdrop-blur md:p-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-600">
                                Admin Settings
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                                API Credentials
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 md:text-base">
                                Keep each provider in its own lane. Payment keys, Delhivery config, and Ekart config are now split into separate, cleaner sections.
                            </p>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                                Save State
                            </div>
                            <div className="mt-2 text-lg font-black text-slate-900">
                                {saving ? 'Saving changes...' : 'Ready to update'}
                            </div>
                            <div className="mt-1 text-xs font-medium text-slate-500">
                                Secrets stay hidden unless you re-enter them.
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {sectionStats.map((section) => {
                            const styles = SECTION_STYLES[section.id];
                            const isActive = activeSection === section.id;

                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => setActiveSection(section.id)}
                                    className={`rounded-[26px] border p-5 text-left transition-all ${isActive ? `${styles.border} ${styles.soft} shadow-lg shadow-black/5` : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'}`}
                                >
                                    <div className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${styles.pill}`}>
                                        {section.subtitle}
                                    </div>
                                    <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-900">{section.title}</h2>
                                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{section.blurb}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 grid gap-6">
                    <SectionCard
                        id="razorpay"
                        eyebrow="Payments"
                        title="Razorpay Credentials"
                        description="This section stays focused on checkout and payment authentication only."
                        activeSection={activeSection}
                        setActiveSection={setActiveSection}
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <InputField
                                section="razorpay"
                                label="Razorpay Key ID"
                                name="razorpayKeyId"
                                value={form.razorpayKeyId}
                                onChange={handleChange}
                                placeholder="rzp_live_xxxxx or rzp_test_xxxxx"
                            />
                            <InputField
                                section="razorpay"
                                label="Razorpay Key Secret"
                                type="password"
                                name="razorpayKeySecret"
                                value={form.razorpayKeySecret}
                                onChange={handleChange}
                                placeholder="Leave blank to keep existing secret"
                                hint="For security, the stored secret is never returned by the API."
                            />
                        </div>
                    </SectionCard>

                    <SectionCard
                        id="delhivery"
                        eyebrow="Courier Partner"
                        title="Delhivery Settings"
                        description="Shipment creation and live tracking details for orders assigned to Delhivery."
                        activeSection={activeSection}
                        setActiveSection={setActiveSection}
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <InputField
                                section="delhivery"
                                label="API Base URL"
                                name="deliveryApi"
                                value={form.deliveryApi}
                                onChange={handleChange}
                                placeholder="https://track.delhivery.com"
                            />
                            <InputField
                                section="delhivery"
                                label="Client Name"
                                name="delhiveryClientName"
                                value={form.delhiveryClientName}
                                onChange={handleChange}
                                placeholder="Your Delhivery client or seller name"
                            />
                            <InputField
                                section="delhivery"
                                label="Pickup Location"
                                name="delhiveryPickupLocation"
                                value={form.delhiveryPickupLocation}
                                onChange={handleChange}
                                placeholder="Exact pickup location from Delhivery"
                            />
                            <InputField
                                section="delhivery"
                                label="Token"
                                type="password"
                                name="delhiveryToken"
                                value={form.delhiveryToken}
                                onChange={handleChange}
                                placeholder="Leave blank to keep existing token"
                                hint="Only enter this when you want to replace the current token."
                            />
                        </div>
                    </SectionCard>

                    <SectionCard
                        id="ekart"
                        eyebrow="Courier Partner"
                        title="Ekart Settings"
                        description="Keep Ekart credentials, paths, and endpoint configuration in their own dedicated block."
                        activeSection={activeSection}
                        setActiveSection={setActiveSection}
                    >
                        <div className="grid gap-6 md:grid-cols-2">
                            <InputField
                                section="ekart"
                                label="Base URL"
                                name="ekartBaseUrl"
                                value={form.ekartBaseUrl}
                                onChange={handleChange}
                                placeholder="https://app.elite.ekartlogistics.in"
                            />
                            <InputField
                                section="ekart"
                                label="Tracking Base URL"
                                name="ekartTrackingBaseUrl"
                                value={form.ekartTrackingBaseUrl}
                                onChange={handleChange}
                                placeholder="Leave blank to reuse Base URL"
                                hint="Use the eKart API host here, not the dashboard shippingHealth page."
                            />
                            <InputField
                                section="ekart"
                                label="Client ID"
                                name="ekartClientId"
                                value={form.ekartClientId}
                                onChange={handleChange}
                                placeholder="EKART_xxxxxxxxx"
                                hint="This is the client_id used to fetch the temporary access token."
                            />
                            <InputField
                                section="ekart"
                                label="Client Name"
                                name="ekartClientName"
                                value={form.ekartClientName}
                                onChange={handleChange}
                                placeholder="Seller or client name used by Ekart"
                            />
                            <InputField
                                section="ekart"
                                label="Pickup Location"
                                name="ekartPickupLocation"
                                value={form.ekartPickupLocation}
                                onChange={handleChange}
                                placeholder="Registered location alias or leave blank"
                                hint="If your eKart account has only one registered pickup location, leave this blank and eKart will autofill it."
                            />
                            <InputField
                                section="ekart"
                                label="Username"
                                name="ekartUsername"
                                value={form.ekartUsername}
                                onChange={handleChange}
                                placeholder="Leave blank if API key is enough"
                            />
                            <InputField
                                section="ekart"
                                label="Password"
                                type="password"
                                name="ekartPassword"
                                value={form.ekartPassword}
                                onChange={handleChange}
                                placeholder="Leave blank to keep existing password"
                            />
                        </div>

                        <div className="mt-6">
                            <InputField
                                section="ekart"
                                label="Static Access Token"
                                type="password"
                                name="ekartApiKey"
                                value={form.ekartApiKey}
                                onChange={handleChange}
                                placeholder="Optional fallback bearer token"
                                hint="Optional. Leave empty if you want the app to fetch `access_token` automatically using Client ID + Username + Password."
                            />
                        </div>

                        <div className="mt-6 grid gap-6 md:grid-cols-3">
                            <InputField
                                section="ekart"
                                label="Create Path"
                                name="ekartCreateShipmentPath"
                                value={form.ekartCreateShipmentPath}
                                onChange={handleChange}
                                placeholder="/api/v1/package/create"
                            />
                            <InputField
                                section="ekart"
                                label="Tracking Path"
                                name="ekartTrackingPath"
                                value={form.ekartTrackingPath}
                                onChange={handleChange}
                                placeholder="/api/v1/track/{id}"
                            />
                            <InputField
                                section="ekart"
                                label="Cancel Path"
                                name="ekartCancelPath"
                                value={form.ekartCancelPath}
                                onChange={handleChange}
                                placeholder="/api/v1/package/cancel"
                            />
                        </div>
                    </SectionCard>

                    <div className="sticky bottom-4 z-20 flex justify-end">
                        <div className="flex items-center gap-4 rounded-full border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-200/50 backdrop-blur">
                            <div className="hidden text-right md:block">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                                    Final Step
                                </div>
                                <div className="text-sm font-bold text-slate-900">
                                    Save all credential changes
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={saving}
                                className={`rounded-full px-6 py-3 text-xs font-black uppercase tracking-[0.22em] transition-all ${saving ? 'cursor-not-allowed bg-slate-300 text-slate-600' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                            >
                                {saving ? 'Saving...' : 'Save Credentials'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RazorpayCredentials;
