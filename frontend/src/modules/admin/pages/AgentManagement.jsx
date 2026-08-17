import React, { useEffect, useMemo, useState } from 'react';
import {
    MdAdd,
    MdEdit,
    MdOutlineBadge,
    MdOutlinePercent,
    MdPeople,
    MdPhone,
    MdRefresh,
    MdSavings,
    MdContentCopy,
    MdCheck,
    MdClose,
    MdEmail,
    MdShoppingBag,
    MdInfo,
    MdSearch
} from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import API from '../../../services/api';

const createInitialForm = () => ({
    id: null,
    name: '',
    email: '',
    phone: '',
    referralCode: '',
    commissionPercent: '10',
    isActive: true,
    notes: ''
});

const formatCurrency = (value) =>
    new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(Number(value || 0));

const formatDateTime = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getInitials = (name = '') =>
    String(name || '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'AG';

const getGradientForInitials = (name = '') => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
        'bg-gradient-to-tr from-primary-500 to-indigo-600 text-white',
        'bg-gradient-to-tr from-emerald-400 to-teal-600 text-white',
        'bg-gradient-to-tr from-violet-500 to-purple-600 text-white',
        'bg-gradient-to-tr from-amber-400 to-orange-600 text-white',
        'bg-gradient-to-tr from-rose-400 to-red-600 text-white',
        'bg-gradient-to-tr from-cyan-500 to-primary-600 text-white',
        'bg-gradient-to-tr from-pink-500 to-rose-600 text-white',
    ];
    return gradients[hash % gradients.length];
};

const CardSkeleton = () => (
    <div className="animate-pulse rounded-[24px] border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-slate-200"></div>
            <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-3/4 rounded bg-slate-200"></div>
                <div className="h-3 w-1/2 rounded bg-slate-200"></div>
            </div>
            <div className="h-5 w-12 rounded bg-slate-200"></div>
        </div>
        <div className="mt-5 h-8 rounded-xl bg-slate-100"></div>
        <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="h-10 rounded-xl bg-slate-100"></div>
            <div className="h-10 rounded-xl bg-slate-100"></div>
            <div className="h-10 rounded-xl bg-slate-100"></div>
        </div>
    </div>
);

const DrawerSkeleton = () => (
    <div className="animate-pulse space-y-6">
        <div className="rounded-3xl bg-slate-50 p-5 space-y-4">
            <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-200"></div>
                <div className="space-y-2 flex-1">
                    <div className="h-5 w-1/3 rounded bg-slate-200"></div>
                    <div className="h-3.5 w-1/2 rounded bg-slate-200"></div>
                </div>
            </div>
            <div className="h-16 rounded-2xl bg-white"></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-slate-50"></div>
            <div className="h-20 rounded-2xl bg-slate-50"></div>
            <div className="h-20 rounded-2xl bg-slate-50"></div>
            <div className="h-20 rounded-2xl bg-slate-50"></div>
        </div>
        <div className="h-48 rounded-3xl bg-slate-50"></div>
    </div>
);

const AgentManagement = () => {
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Drawer states
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerMode, setDrawerMode] = useState('view'); // 'view' | 'edit' | 'create'
    const [drawerTab, setDrawerTab] = useState('overview'); // 'overview' | 'orders'
    const [copiedCode, setCopiedCode] = useState(null);
    const [form, setForm] = useState(createInitialForm());

    const isEditing = drawerMode === 'edit';
    const isCreating = drawerMode === 'create';

    const loadAgentDetails = async (agentId) => {
        if (!agentId) {
            setSelectedAgent(null);
            return;
        }

        setDetailLoading(true);
        try {
            const { data } = await API.get(`/agents/${agentId}`);
            setSelectedAgent(data);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load agent details');
        } finally {
            setDetailLoading(false);
        }
    };

    const loadAgents = async () => {
        setLoading(true);
        try {
            const { data } = await API.get('/agents');
            setAgents(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load agents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAgents();
    }, []);

    const totals = useMemo(() => (
        agents.reduce((acc, agent) => {
            acc.totalAgents += 1;
            acc.activeAgents += agent.isActive ? 1 : 0;
            acc.totalCommission += Number(agent.summary?.commissionEarned || 0);
            acc.totalCustomers += Number(agent.summary?.uniqueCustomers || 0);
            return acc;
        }, {
            totalAgents: 0,
            activeAgents: 0,
            totalCommission: 0,
            totalCustomers: 0
        })
    ), [agents]);

    const filteredAgents = useMemo(() => {
        const query = String(searchTerm || '').trim().toLowerCase();
        if (!query) return agents;

        return agents.filter((agent) => (
            String(agent.name || '').toLowerCase().includes(query)
            || String(agent.referralCode || '').toLowerCase().includes(query)
            || String(agent.email || '').toLowerCase().includes(query)
            || String(agent.phone || '').toLowerCase().includes(query)
        ));
    }, [agents, searchTerm]);

    const handleCopyCode = (code, event) => {
        if (event) event.stopPropagation();
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast.success(`Copied: ${code}`);
        setTimeout(() => setCopiedCode(null), 2000);
    };

    const handleCardClick = async (agent) => {
        setDrawerTab('overview');
        setDrawerMode('view');
        setDrawerOpen(true);
        await loadAgentDetails(agent._id);
    };

    const handleAddAgentClick = () => {
        setForm(createInitialForm());
        setDrawerMode('create');
        setDrawerOpen(true);
    };

    const handleEditClick = (agent) => {
        setForm({
            id: agent._id,
            name: agent.name || '',
            email: agent.email || '',
            phone: agent.phone || '',
            referralCode: agent.referralCode || '',
            commissionPercent: String(agent.commissionPercent ?? 10),
            isActive: agent.isActive !== false,
            notes: agent.notes || ''
        });
        setDrawerMode('edit');
    };

    const handleCancelEdit = () => {
        if (isCreating) {
            setDrawerOpen(false);
        } else {
            setDrawerMode('view');
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.name.trim()) {
            toast.error('Agent name is required');
            return;
        }
        if (!form.referralCode.trim()) {
            toast.error('Referral code is required');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                referralCode: form.referralCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
                commissionPercent: Number(form.commissionPercent),
                isActive: form.isActive,
                notes: form.notes.trim()
            };

            if (isEditing) {
                await API.put(`/agents/${form.id}`, payload);
                toast.success('Agent updated successfully');
                await loadAgents();
                await loadAgentDetails(form.id);
                setDrawerMode('view');
            } else {
                const { data } = await API.post('/agents', payload);
                toast.success('Agent created successfully');
                await loadAgents();
                await loadAgentDetails(data?._id);
                setDrawerMode('view');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save agent');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-[1600px] space-y-6 pb-12 px-4 sm:px-6">
            {/* Header & Stats Banner */}
            <div className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
                {/* Decorative Subtle Background Pattern */}
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.06),_transparent_45%)] bg-[linear-gradient(135deg,_#ffffff,_#f8fafc)]" />
                
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700">
                            <span className="flex h-2 w-2 rounded-full bg-primary-600 animate-pulse" />
                            Referral Network & Agents
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Agent Management</h1>
                        <p className="max-w-xl text-sm font-medium leading-relaxed text-slate-500">
                            Monitor partner stats, manage commissions, inspect customer referrers, and configure active campaign options.
                        </p>
                    </div>

                    {/* Stats Tiles */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto xl:min-w-[600px]">
                        <div className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:border-primary-100 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Agents</p>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-2xl font-black text-slate-800">{totals.totalAgents}</span>
                                <span className="rounded-lg bg-slate-50 p-2 text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition">
                                    <MdPeople size={18} />
                                </span>
                            </div>
                        </div>

                        <div className="group rounded-2xl border border-emerald-100 bg-emerald-50/20 p-4 shadow-sm transition hover:border-emerald-200 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Active</p>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-2xl font-black text-emerald-700">{totals.activeAgents}</span>
                                <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600 transition">
                                    <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                                </span>
                            </div>
                        </div>

                        <div className="group rounded-2xl border border-primary-100 bg-primary-50/20 p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-wider text-primary-600">Customers</p>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-2xl font-black text-primary-700">{totals.totalCustomers}</span>
                                <span className="rounded-lg bg-primary-50 p-2 text-primary-600 transition">
                                    <MdPeople size={18} />
                                </span>
                            </div>
                        </div>

                        <div className="group rounded-2xl border border-amber-100 bg-amber-50/20 p-4 shadow-sm transition hover:border-amber-200 hover:shadow-md">
                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Total Earned</p>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="text-xl font-black text-amber-700 truncate">{formatCurrency(totals.totalCommission)}</span>
                                <span className="rounded-lg bg-amber-50 p-2 text-amber-600 transition">
                                    <MdSavings size={18} />
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions & Filters Toolbar */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white rounded-[24px] border border-slate-100 p-4 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                        <MdSearch size={20} />
                    </span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search by name, code, email, or phone..."
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:bg-white placeholder-slate-400"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={loadAgents}
                        disabled={loading}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-60"
                        title="Refresh agent list"
                    >
                        <MdRefresh size={20} className={loading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        type="button"
                        onClick={handleAddAgentClick}
                        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary-600 px-5 text-sm font-bold text-white shadow-md shadow-primary-200 hover:bg-primary-700 transition hover:shadow-lg active:scale-95"
                    >
                        <MdAdd size={20} />
                        Add Agent
                    </button>
                </div>
            </div>

            {/* Agents List Grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, idx) => (
                        <CardSkeleton key={idx} />
                    ))}
                </div>
            ) : filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 px-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 mb-4">
                        <MdPeople size={30} />
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900">No Agents Found</h3>
                    <p className="mt-2 max-w-sm text-sm font-medium text-slate-500">
                        {searchTerm ? 'No results matched your search query. Try clearing or expanding your term.' : 'Get started by creating a new referral agent in the network.'}
                    </p>
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                        >
                            Clear Search
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredAgents.map((agent) => (
                        <div
                            key={agent._id}
                            onClick={() => handleCardClick(agent)}
                            className="group relative cursor-pointer rounded-[24px] border border-slate-200/60 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary-200 hover:shadow-md hover:shadow-slate-100"
                        >
                            {/* Card Content */}
                            <div className="flex items-start gap-4">
                                {/* Avatar */}
                                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-black shadow-sm shadow-slate-100 ${getGradientForInitials(agent.name)}`}>
                                    {getInitials(agent.name)}
                                </div>

                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="truncate text-base font-bold tracking-tight text-slate-800 group-hover:text-primary-600 transition">
                                            {agent.name}
                                        </h3>
                                        <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                            agent.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
                                        }`}>
                                            {agent.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <p className="truncate text-xs font-semibold text-slate-400">
                                        {agent.email || 'No Email'}
                                    </p>
                                </div>
                            </div>

                            {/* Referral Code Badge */}
                            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 transition hover:bg-slate-100/50">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <MdOutlineBadge className="text-slate-400 shrink-0" size={16} />
                                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-700 truncate">
                                        {agent.referralCode}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(event) => handleCopyCode(agent.referralCode, event)}
                                    className="p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-white transition"
                                    title="Copy Code"
                                >
                                    {copiedCode === agent.referralCode ? (
                                        <MdCheck size={14} className="text-emerald-600" />
                                    ) : (
                                        <MdContentCopy size={14} />
                                    )}
                                </button>
                            </div>

                            {/* Stats Summary Rows */}
                            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                                <div className="text-center">
                                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Rate</p>
                                    <p className="mt-1 text-sm font-extrabold text-slate-700">
                                        {Number(agent.commissionPercent || 0).toFixed(0)}%
                                    </p>
                                </div>
                                <div className="border-x border-slate-100 text-center">
                                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Users</p>
                                    <p className="mt-1 text-sm font-extrabold text-slate-700">
                                        {agent.summary?.uniqueCustomers || 0}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Earned</p>
                                    <p className="mt-1 text-sm font-black text-amber-600 truncate px-1">
                                        {formatCurrency(agent.summary?.commissionEarned || 0).replace('₹', '₹ ')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Slider Drawer (Details & Forms) */}
            <AnimatePresence>
                {drawerOpen && (
                    <>
                        {/* Backdrop Blur overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !saving && setDrawerOpen(false)}
                            className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-[4px]"
                        />

                        {/* Drawer body */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl border-l border-slate-100 sm:max-w-[580px]"
                        >
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {isCreating ? 'Actions Workspace' : 'Agent Overview'}
                                    </span>
                                    <h2 className="text-xl font-extrabold text-slate-900">
                                        {isCreating ? 'Add New Partner' : isEditing ? 'Edit Profile' : selectedAgent?.name || 'Agent Detail'}
                                    </h2>
                                </div>

                                <div className="flex items-center gap-2">
                                    {!isCreating && !isEditing && selectedAgent && (
                                        <button
                                            type="button"
                                            onClick={() => handleEditClick(selectedAgent)}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95"
                                        >
                                            <MdEdit size={16} />
                                            Edit
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => setDrawerOpen(false)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition active:scale-90"
                                    >
                                        <MdClose size={22} />
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                                {detailLoading && !isCreating ? (
                                    <DrawerSkeleton />
                                ) : isCreating || isEditing ? (
                                    /* Edit & Create Forms */
                                    <form onSubmit={handleSubmit} id="agent-drawer-form" className="space-y-5">
                                        <div className="space-y-4">
                                            <label className="block">
                                                <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Agent Name *</span>
                                                <input
                                                    type="text"
                                                    value={form.name}
                                                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                                                    required
                                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:bg-white"
                                                    placeholder="e.g. Rahul Sharma"
                                                />
                                            </label>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <label className="block">
                                                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Email Address</span>
                                                    <input
                                                        type="email"
                                                        value={form.email}
                                                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:bg-white"
                                                        placeholder="rahul@example.com"
                                                    />
                                                </label>
                                                <label className="block">
                                                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Phone Number</span>
                                                    <input
                                                        type="tel"
                                                        value={form.phone}
                                                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:bg-white"
                                                        placeholder="10-digit number"
                                                    />
                                                </label>
                                            </div>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <label className="block">
                                                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Referral Code *</span>
                                                    <input
                                                        type="text"
                                                        value={form.referralCode}
                                                        onChange={(event) => setForm((current) => ({ ...current, referralCode: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                                                        required
                                                        disabled={isEditing}
                                                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono font-bold uppercase tracking-wider text-slate-800 outline-none transition focus:border-primary-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                                                        placeholder="e.g. INDRAHUL20"
                                                    />
                                                </label>
                                                <label className="block">
                                                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Commission Rate (%) *</span>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            value={form.commissionPercent}
                                                            onChange={(event) => setForm((current) => ({ ...current, commissionPercent: event.target.value }))}
                                                            required
                                                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-10 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:bg-white"
                                                            placeholder="10"
                                                        />
                                                        <span className="absolute inset-y-0 right-4 flex items-center text-slate-400">
                                                            <MdOutlinePercent size={18} />
                                                        </span>
                                                    </div>
                                                </label>
                                            </div>

                                            <label className="block">
                                                <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Notes / Descriptions</span>
                                                <textarea
                                                    rows="3"
                                                    value={form.notes}
                                                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary-500 focus:bg-white"
                                                    placeholder="Add campaign source details, payouts account info, notes..."
                                                />
                                            </label>

                                            <label className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100/50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.isActive}
                                                    onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                                                    className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <div className="text-sm">
                                                    <p className="font-bold text-slate-700">Set agent as Active</p>
                                                    <p className="text-xs text-slate-400 font-medium">When checked, clients can apply this code on checkout.</p>
                                                </div>
                                            </label>
                                        </div>
                                    </form>
                                ) : selectedAgent ? (
                                    /* Read Only details */
                                    <div className="space-y-6">
                                        {/* Avatar & Profile Panel */}
                                        <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/50 p-5">
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black ${getGradientForInitials(selectedAgent.name)}`}>
                                                    {getInitials(selectedAgent.name)}
                                                </div>
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="flex items-center flex-wrap gap-2">
                                                        <h3 className="text-xl font-black text-slate-800">{selectedAgent.name}</h3>
                                                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                                            selectedAgent.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {selectedAgent.isActive ? 'Active' : 'Suspended'}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-col gap-y-1 sm:flex-row sm:items-center sm:gap-x-4 text-xs font-semibold text-slate-500">
                                                        {selectedAgent.email && (
                                                            <span className="flex items-center gap-1.5">
                                                                <MdEmail className="text-slate-400" />
                                                                {selectedAgent.email}
                                                            </span>
                                                        )}
                                                        {selectedAgent.phone && (
                                                            <span className="flex items-center gap-1.5">
                                                                <MdPhone className="text-slate-400" />
                                                                {selectedAgent.phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Code Card block inside profile */}
                                            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white border border-slate-100 p-4">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Referral Code</p>
                                                    <p className="font-mono text-base font-bold tracking-wider text-slate-700 uppercase">
                                                        {selectedAgent.referralCode}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Commission</p>
                                                        <p className="text-sm font-extrabold text-slate-800">
                                                            {Number(selectedAgent.commissionPercent || 0).toFixed(1)}%
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyCode(selectedAgent.referralCode)}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-primary-600 transition"
                                                        title="Copy Code"
                                                    >
                                                        {copiedCode === selectedAgent.referralCode ? (
                                                            <MdCheck className="text-emerald-600" size={18} />
                                                        ) : (
                                                            <MdContentCopy size={16} />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {selectedAgent.notes && (
                                                <div className="mt-4 border-t border-slate-100 pt-4">
                                                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Administrative Notes</p>
                                                    <p className="text-xs font-semibold leading-relaxed text-slate-600">
                                                        {selectedAgent.notes}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Performance Stats Panels */}
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                            <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm text-center">
                                                <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Referral Orders</p>
                                                <p className="mt-2 text-lg font-black text-slate-800">
                                                    {selectedAgent.summary?.totalReferralOrders || 0}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-emerald-50 bg-emerald-50/10 p-3.5 shadow-sm text-center">
                                                <p className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600">Delivered</p>
                                                <p className="mt-2 text-lg font-black text-emerald-700">
                                                    {selectedAgent.summary?.successfulReferralOrders || 0}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-rose-50 bg-rose-50/10 p-3.5 shadow-sm text-center">
                                                <p className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600">Cancelled</p>
                                                <p className="mt-2 text-lg font-black text-rose-700">
                                                    {selectedAgent.summary?.cancelledReferralOrders || 0}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-primary-50 bg-primary-50/10 p-3.5 shadow-sm text-center">
                                                <p className="text-[9px] font-extrabold uppercase tracking-wider text-primary-600">Commission</p>
                                                <p className="mt-2 text-base font-black text-primary-800 truncate px-0.5">
                                                    {formatCurrency(selectedAgent.summary?.commissionEarned || 0).replace('₹', '₹ ')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Tabbed view details */}
                                        <div className="space-y-4">
                                            {/* Tab Buttons */}
                                            <div className="flex border-b border-slate-100">
                                                <button
                                                    type="button"
                                                    onClick={() => setDrawerTab('overview')}
                                                    className={`pb-3 text-sm font-bold border-b-2 px-1 transition ${
                                                        drawerTab === 'overview'
                                                            ? 'border-primary-600 text-primary-600'
                                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                                    }`}
                                                >
                                                    Overview & Log
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDrawerTab('orders')}
                                                    className={`ml-6 pb-3 text-sm font-bold border-b-2 px-1 transition ${
                                                        drawerTab === 'orders'
                                                            ? 'border-primary-600 text-primary-600'
                                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                                    }`}
                                                >
                                                    Referral Orders ({selectedAgent.orders?.length || 0})
                                                </button>
                                            </div>

                                            {/* Tab Contents */}
                                            {drawerTab === 'overview' ? (
                                                <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600">
                                                            <MdSavings size={20} />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-400">Total Commissions Due / Paid</p>
                                                            <p className="text-lg font-black text-slate-800 mt-0.5">
                                                                {formatCurrency(selectedAgent.summary?.commissionEarned || 0)}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <hr className="border-slate-100" />

                                                    <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-500">
                                                        <div>
                                                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Created At</p>
                                                            <p className="mt-1 text-slate-700">{formatDateTime(selectedAgent.createdAt)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Last Updated</p>
                                                            <p className="mt-1 text-slate-700">{formatDateTime(selectedAgent.updatedAt)}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Referral Orders List Tab */
                                                <div className="space-y-3">
                                                    {selectedAgent.orders?.length ? (
                                                        selectedAgent.orders.map((order) => (
                                                            <div
                                                                key={order._id}
                                                                className="rounded-2xl border border-slate-100 bg-white p-4 transition hover:border-slate-200"
                                                            >
                                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono text-sm font-bold text-slate-800">
                                                                                {order.displayId || order._id.substring(0, 8)}
                                                                            </span>
                                                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                                                                order.status === 'Cancelled'
                                                                                    ? 'bg-rose-50 text-rose-700'
                                                                                    : order.status === 'Delivered'
                                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                                    : 'bg-primary-50 text-primary-700'
                                                                            }`}>
                                                                                {order.status}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-xs font-bold text-slate-600">
                                                                            {order.customerName || 'No Name'} • <span className="text-slate-400 font-medium">{order.customerPhone || 'No Phone'}</span>
                                                                        </p>
                                                                        <p className="text-[10px] font-semibold text-slate-400">
                                                                            {formatDateTime(order.createdAt)}
                                                                        </p>
                                                                    </div>

                                                                    <div className="border-t border-slate-50 pt-2 sm:border-0 sm:pt-0 text-left sm:text-right text-xs font-bold text-slate-500 space-y-1">
                                                                        <p>
                                                                            Value: <span className="text-slate-800 font-extrabold">{formatCurrency(order.itemsPrice)}</span>
                                                                        </p>
                                                                        <p>
                                                                            Commission ({Number(order.commissionPercent || 0).toFixed(0)}%): <span className="text-amber-600 font-black">{formatCurrency(order.commissionAmount)}</span>
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-10 text-center">
                                                            <div className="text-slate-400 mb-2">
                                                                <MdShoppingBag size={24} />
                                                            </div>
                                                            <p className="text-sm font-bold text-slate-700">No referral orders yet</p>
                                                            <p className="text-xs text-slate-400 max-w-xs mt-1">
                                                                Referral sales details will compile automatically here when users checkout with this agent code.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center text-center">
                                        <MdInfo className="text-slate-300" size={32} />
                                        <p className="text-sm font-semibold text-slate-500 mt-2">Error loading details</p>
                                    </div>
                                )}
                            </div>

                            {/* Drawer Footer */}
                            {(isCreating || isEditing) && (
                                <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={handleCancelEdit}
                                        className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition active:scale-95 disabled:opacity-60"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        form="agent-drawer-form"
                                        disabled={saving}
                                        className="h-11 rounded-2xl bg-primary-600 px-6 text-sm font-bold text-white shadow-md shadow-primary-200 hover:bg-primary-700 transition active:scale-95 disabled:bg-primary-400 disabled:shadow-none"
                                    >
                                        {saving ? (
                                            <span className="flex items-center gap-2">
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                                Saving...
                                            </span>
                                        ) : isCreating ? (
                                            'Create Agent'
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AgentManagement;

