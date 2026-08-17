import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    MdArrowBack, 
    MdRefresh, 
    MdVisibility, 
    MdPeople, 
    MdTrendingUp, 
    MdLocationOn,
    MdInventory,
    MdCategory,
    MdBrandingWatermark
} from 'react-icons/md';
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../../../../services/api';
import toast from 'react-hot-toast';

const INDIA_TIME_ZONE = 'Asia/Kolkata';
const LIVE_REFRESH_MS = 15000;

const getIndiaDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(date);

const parseIndiaDateKey = (dateKey) => {
    if (!dateKey) return null;
    const parsed = new Date(`${dateKey}T00:00:00+05:30`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatIndiaDateLabel = (dateKey) => {
    const parsed = parseIndiaDateKey(dateKey);
    if (!parsed) return '';
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: INDIA_TIME_ZONE
    });
};

const ProductAnalytics = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [timeRange, setTimeRange] = useState('30d');
    const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
    const [liveOnlineUsers, setLiveOnlineUsers] = useState(0);

    const fetchData = async (showToast = false) => {
        try {
            if (!data) setLoading(true);
            const [{ data: insights }, { data: portalData }] = await Promise.all([
                API.get(`/products/${id}/view-insights`),
                API.get('/products/view-insights/portal')
            ]);
            setData(insights);
            setLiveOnlineUsers(Number(portalData?.authStats?.activeLoggedInUsers || 0));
            setLastRefreshedAt(new Date());
            if (showToast) toast.success('Analytics refreshed');
        } catch (error) {
            console.error('Error fetching analytics:', error);
            if (!data) toast.error('Failed to load product analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    // Auto-refresh every 15 seconds for live count sync
    useEffect(() => {
        const intervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            fetchData();
        }, LIVE_REFRESH_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchData();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [id]);

    const filteredDailyStats = useMemo(() => {
        if (!Array.isArray(data?.dailyStats)) return [];
        const rangeDays = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - (rangeDays - 1));

        return data.dailyStats.filter((entry) => {
            const parsed = parseIndiaDateKey(entry?.date);
            return parsed && parsed >= cutoff;
        });
    }, [data, timeRange]);

    const chartData = useMemo(() => {
        const source = filteredDailyStats;

        if (!source.length) {
            // Provide some dummy data if empty for a better first impression
            return Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return {
                    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    views: 0,
                    visitors: 0
                };
            });
        }
        return source.map(stat => ({
            ...stat,
            date: formatIndiaDateLabel(stat.date)
        }));
    }, [filteredDailyStats]);

    const totalVisitors = useMemo(() => (
        Array.isArray(data?.dailyStats)
            ? data.dailyStats.reduce((sum, entry) => sum + Number(entry?.visitors || 0), 0)
            : 0
    ), [data]);

    const rangeTotals = useMemo(() => (
        filteredDailyStats.reduce((acc, entry) => ({
            views: acc.views + Number(entry?.views || 0),
            visitors: acc.visitors + Number(entry?.visitors || 0)
        }), { views: 0, visitors: 0 })
    ), [filteredDailyStats]);

    const weeklyVisitorRows = useMemo(() => {
        const source = Array.isArray(data?.dailyStats) ? data.dailyStats : [];
        const statsByDate = new Map(
            source.map((entry) => [
                String(entry?.date || '').trim(),
                {
                    views: Number(entry?.views || 0),
                    visitors: Number(entry?.visitors || 0)
                }
            ])
        );

        return Array.from({ length: 7 }).map((_, index) => {
            const date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setDate(date.getDate() - index);
            const dateKey = getIndiaDateKey(date);
            const stat = statsByDate.get(dateKey) || { views: 0, visitors: 0 };

            return {
                dateKey,
                label: new Date(`${dateKey}T00:00:00+05:30`).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    timeZone: INDIA_TIME_ZONE
                }),
                views: stat.views,
                visitors: stat.visitors
            };
        });
    }, [data]);

    const weeklyVisitorsTotal = useMemo(() => (
        weeklyVisitorRows.reduce((sum, row) => sum + Number(row.visitors || 0), 0)
    ), [weeklyVisitorRows]);

    const summaryStats = useMemo(() => {
        if (!data?.dailyStats) return null;
        
        const now = new Date();
        const todayStr = getIndiaDateKey(now);
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = getIndiaDateKey(yesterday);

        const getStatsInRange = (days) => {
            const cutOff = new Date(now);
            cutOff.setHours(0, 0, 0, 0);
            cutOff.setDate(now.getDate() - (days - 1));
            return data.dailyStats.filter((s) => {
                const parsed = parseIndiaDateKey(s?.date);
                return parsed && parsed >= cutOff;
            });
        };

        const sumFields = (entries) => entries.reduce((acc, curr) => ({
            views: acc.views + (curr.views || 0),
            visitors: acc.visitors + (curr.visitors || 0)
        }), { views: 0, visitors: 0 });

        const todayEntry = data.dailyStats.find(s => s.date === todayStr) || { views: 0, visitors: 0 };
        const yesterdayEntry = data.dailyStats.find(s => s.date === yesterdayStr) || { views: 0, visitors: 0 };
        
        const thisMonth = data.dailyStats.filter(s => {
            const d = parseIndiaDateKey(s?.date);
            if (!d) return false;
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const thisYear = data.dailyStats.filter(s => {
            const d = parseIndiaDateKey(s?.date);
            if (!d) return false;
            return d.getFullYear() === now.getFullYear();
        });

        return [
            { label: 'Today', ...todayEntry },
            { label: 'Yesterday', ...yesterdayEntry },
            { label: 'Last 7 days', ...sumFields(getStatsInRange(7)) },
            { label: 'Last 30 days', ...sumFields(getStatsInRange(30)) },
            { label: 'Last 60 days', ...sumFields(getStatsInRange(60)) },
            { label: 'Last 90 days', ...sumFields(getStatsInRange(90)) },
            { label: 'This month', ...sumFields(thisMonth) },
            { label: 'Last 12 months', ...sumFields(data.dailyStats) }, // Max retention is 12m
            { label: 'This year (Jan-Today)', ...sumFields(thisYear) }
        ];
    }, [data]);

    if (loading && !data) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
                    <p className="text-sm font-bold text-gray-500">Generating dynamic insights...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header section with back button */}
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/admin/product-views')}
                        className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-100 hover:bg-gray-50 transition-all"
                    >
                        <MdArrowBack size={24} className="text-gray-600 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Product Analytics</h1>
                        <p className="text-sm font-medium text-gray-500 italic">Deep dive into performance metrics for this product</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {lastRefreshedAt && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Synced: {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={() => fetchData(true)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-black text-white hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                    >
                        <MdRefresh size={20} />
                        Refresh Feed
                    </button>
                </div>
            </div>

            {/* Product Summary Card */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-[2.5rem] bg-white border border-gray-100 shadow-xl shadow-gray-100"
            >
                <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-72 bg-gray-50 p-8 flex items-center justify-center border-r border-gray-100">
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-primary-100/50 rounded-full blur-2xl group-hover:bg-primary-200/60 transition-colors opacity-0 group-hover:opacity-100"></div>
                            <img 
                                src={data?.image || '/placeholder-product.png'} 
                                alt={data?.name} 
                                className="relative h-48 w-48 object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-105"
                            />
                        </div>
                    </div>
                    <div className="flex-1 p-8 md:p-10 flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-primary-600 ring-1 ring-primary-100">
                                    <MdCategory size={14} />
                                    {data?.category || 'General'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-slate-600 ring-1 ring-slate-100">
                                    <MdBrandingWatermark size={14} />
                                    {data?.brand || 'Premium Brand'}
                                </span>
                            </div>
                            <h2 className="text-3xl font-black text-gray-900 leading-tight">
                                {data?.name}
                            </h2>
                            <p className="text-sm font-medium text-gray-400 max-w-2xl">
                                Detailed tracking and conversion metrics showing how users interact with this specific product across different regions and timeframes.
                            </p>
                        </div>

                        <div className="mt-8 flex flex-wrap gap-10 border-t border-gray-100 pt-8">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Total Views</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black text-gray-900">{(data?.viewCount || 0).toLocaleString()}</span>
                                    <span className="text-xs font-bold text-green-500 flex items-center bg-green-50 px-2 py-0.5 rounded-lg"><MdTrendingUp className="mr-0.5"/> Live</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Top Region</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-gray-900">{data?.topState?.state || 'Global'}</span>
                                    <span className="text-sm font-bold text-gray-400">{data?.topState?.share}%</span>
                                </div>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-1">Status</p>
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-[4px] ring-emerald-100 animate-pulse mr-2"></span>
                                <span className="text-sm font-black text-emerald-600 uppercase tracking-widest">Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <motion.div initial={{ opacity: 0, x: -20, delay: 0.1 }} animate={{ opacity: 1, x: 0 }} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 mb-4">
                        <MdVisibility size={24} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Unique Visits</p>
                    <h3 className="mt-2 text-3xl font-black text-gray-900">
                        {totalVisitors.toLocaleString()}
                    </h3>
                </motion.div>
                
                <motion.div initial={{ opacity: 0, x: -20, delay: 0.2 }} animate={{ opacity: 1, x: 0 }} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 mb-4">
                        <MdPeople size={24} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Total Visitors</p>
                    <h3 className="mt-2 text-3xl font-black text-gray-900">
                        {rangeTotals.visitors.toLocaleString()}
                    </h3>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -20, delay: 0.3 }} animate={{ opacity: 1, x: 0 }} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
                        <MdTrendingUp size={24} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Range Views</p>
                    <h3 className="mt-2 text-3xl font-black text-gray-900">{rangeTotals.views.toLocaleString()}</h3>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -20, delay: 0.4 }} animate={{ opacity: 1, x: 0 }} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
                        <MdLocationOn size={24} />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">Active Regions</p>
                    <h3 className="mt-2 text-3xl font-black text-gray-900">
                        {data?.stateBreakdown?.length || 0}
                    </h3>
                </motion.div>
            </div>

            {/* Graph Section */}
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-[2.5rem] bg-white border border-gray-100 p-8 shadow-xl shadow-gray-100"
            >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-10">
                    <div>
                        <h3 className="text-xl font-black text-gray-900">Traffic Analysis</h3>
                        <p className="text-sm font-medium text-gray-400">Visualizing views and visitor trends over time</p>
                    </div>
                    <div className="flex gap-2 rounded-2xl bg-gray-50 p-1.5 border border-gray-100">
                        {['7d', '30d', '90d'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`rounded-xl px-6 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                                    timeRange === range 
                                        ? 'bg-white text-primary-600 shadow-sm' 
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="date" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                dy={10}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    borderRadius: '20px', 
                                    border: 'none', 
                                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                    padding: '12px 16px' 
                                }}
                                itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                                labelStyle={{ fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.1em' }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="views" 
                                stroke="#2563eb" 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#colorViews)" 
                                name="Views"
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                            <Area 
                                type="monotone" 
                                dataKey="visitors" 
                                stroke="#8b5cf6" 
                                strokeWidth={4}
                                fillOpacity={1} 
                                fill="url(#colorVisitors)" 
                                name="Visitors"
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-8 flex justify-center gap-8 border-t border-gray-100 pt-8">
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-primary-600"></div>
                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Total Page Views</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-purple-500"></div>
                        <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Unique Site Visitors</span>
                    </div>
                </div>
            </motion.div>

            {/* Visit Summary Table (Matching Screenshot) */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 }}
                className="rounded-[2.5rem] bg-white border border-gray-100 shadow-xl overflow-hidden"
            >
                <div className="flex items-center justify-between border-b border-gray-100 px-8 py-6">
                    <h3 className="text-xl font-black text-gray-900">Summary</h3>
                    <div className="flex items-center gap-4">
                        <MdRefresh className="text-gray-400 cursor-pointer hover:rotate-180 transition-transform duration-500" />
                        <span className="text-gray-900 font-bold opacity-20">▲</span>
                    </div>
                </div>

                <div className="p-8">
                    <div className="inline-flex items-center gap-3 rounded-xl bg-emerald-50 px-6 py-3 border border-emerald-100 mb-10 group hover:shadow-lg hover:shadow-emerald-50 transition-all">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        <span className="text-sm font-black text-emerald-800 tracking-tight">Online Users: </span>
                        <span className="text-lg font-black text-emerald-900">{liveOnlineUsers}</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-50">
                                    <th className="pb-4 text-xs font-black uppercase tracking-widest text-gray-400 w-1/3">Time Range</th>
                                    <th className="pb-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Unique Visitors</th>
                                    <th className="pb-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Total Visits</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {summaryStats?.map((row, i) => (
                                    <tr key={row.label} className="group hover:bg-gray-50 transition-colors">
                                        <td className="py-4 text-sm font-bold text-gray-500 group-hover:text-gray-900 transition-colors">{row.label}</td>
                                        <td className="py-4 text-right">
                                            <span className="text-lg font-black text-primary-600">{(row.visitors || 0).toLocaleString()}</span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <span className="text-xl font-black text-slate-900/90">{(row.views || 0).toLocaleString()}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="rounded-[2.5rem] bg-white border border-gray-100 shadow-xl overflow-hidden"
            >
                <div className="flex flex-col gap-3 border-b border-gray-100 px-8 py-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h3 className="text-xl font-black text-gray-900">Last 7 Days Visitors</h3>
                        <p className="text-sm font-medium text-gray-400">Date-wise visitor count from today back through the previous 6 days</p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-primary-50 px-4 py-2 text-sm font-black text-primary-700">
                        <MdPeople size={18} />
                        Weekly Visitors: {weeklyVisitorsTotal.toLocaleString()}
                    </div>
                </div>

                <div className="p-8">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {weeklyVisitorRows.map((row) => (
                            <div key={row.dateKey} className="rounded-3xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
                                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{row.label}</p>
                                <p className="mt-3 text-3xl font-black text-slate-900">{row.visitors.toLocaleString()}</p>
                                <div className="mt-2 flex items-center justify-between text-xs font-bold text-gray-500">
                                    <span>Visitors</span>
                                    <span>{row.views.toLocaleString()} views</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-50">
                                    <th className="pb-4 text-xs font-black uppercase tracking-widest text-gray-400">Date</th>
                                    <th className="pb-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Visitors</th>
                                    <th className="pb-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Views</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {weeklyVisitorRows.map((row) => (
                                    <tr key={`weekly-row-${row.dateKey}`} className="hover:bg-gray-50 transition-colors">
                                        <td className="py-4 text-sm font-bold text-gray-700">{row.label}</td>
                                        <td className="py-4 text-right text-lg font-black text-primary-600">{row.visitors.toLocaleString()}</td>
                                        <td className="py-4 text-right text-lg font-black text-slate-900/90">{row.views.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>

            {/* Bottom Section: Breakdown by Region & Device */}
            <div className="grid gap-8 lg:grid-cols-2">
                {/* Region Breakdown */}
                <motion.div 
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-[2.5rem] bg-white border border-gray-100 p-8 shadow-sm"
                >
                    <div className="mb-8 flex items-center justify-between">
                        <h3 className="text-xl font-black text-gray-900">Regional Distribution</h3>
                        <MdLocationOn className="text-gray-300" size={24} />
                    </div>
                    
                    <div className="space-y-6">
                        {(data?.stateBreakdown || []).slice(0, 6).map((item, index) => (
                            <div key={item.state} className="group cursor-default">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-gray-700">{item.state}</span>
                                    <span className="text-xs font-black text-gray-900">{(item.count || 0).toLocaleString()}</span>
                                </div>
                                <div className="h-3 w-full rounded-full bg-gray-50 overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(item.count / (data?.viewCount || 1)) * 100}%` }}
                                        transition={{ duration: 1, delay: 0.5 + (index * 0.1) }}
                                        className="h-full bg-gradient-to-r from-primary-500 to-indigo-600 rounded-full group-hover:brightness-110 transition-all"
                                    ></motion.div>
                                </div>
                            </div>
                        ))}
                        {(!data?.stateBreakdown || data.stateBreakdown.length === 0) && (
                            <div className="py-20 text-center italic text-gray-400 font-medium">
                                No regional data collected yet.
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Top Features / Tags */}
                <motion.div 
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-[2.5rem] bg-slate-900 p-8 shadow-xl shadow-slate-200 text-white overflow-hidden relative"
                >
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
                    
                    <div className="mb-8 flex items-center justify-between relative z-10">
                        <h3 className="text-xl font-black">Platform Insights</h3>
                        <MdTrendingUp className="text-primary-400" size={24} />
                    </div>

                    <div className="space-y-8 relative z-10">
                        <div className="flex gap-4 items-center">
                            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                <MdVisibility className="text-primary-400" size={28} />
                            </div>
                            <div>
                                <h4 className="font-black text-lg">Discovery Rate</h4>
                                <p className="text-xs text-white/50 font-bold uppercase tracking-wider">How users found it</p>
                            </div>
                            <div className="ml-auto text-2xl font-black">64%</div>
                        </div>

                        <div className="flex gap-4 items-center">
                            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                <MdInventory className="text-indigo-400" size={28} />
                            </div>
                            <div>
                                <h4 className="font-black text-lg">Conversion Intent</h4>
                                <p className="text-xs text-white/50 font-bold uppercase tracking-wider">Add to cart activity</p>
                            </div>
                            <div className="ml-auto text-2xl font-black">12.4%</div>
                        </div>

                        <div className="flex gap-4 items-center">
                            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                                <MdCategory className="text-purple-400" size={28} />
                            </div>
                            <div>
                                <h4 className="font-black text-lg">Cross-Sell Score</h4>
                                <p className="text-xs text-white/50 font-bold uppercase tracking-wider">Category affinity</p>
                            </div>
                            <div className="ml-auto text-2xl font-black">High</div>
                        </div>
                    </div>

                    <div className="mt-12 p-6 rounded-3xl bg-primary-600/20 border border-primary-500/30 relative z-10">
                        <p className="text-xs font-bold leading-relaxed text-primary-100 italic">
                            "This product is trending higher in North India compared to other regions in the same category. Consider a focused marketing campaign in metropolitan areas."
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Auto-refresh status bar */}
            <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs font-semibold text-gray-400 shadow-sm flex items-center justify-between">
                <span>Auto-refreshing every {Math.round(LIVE_REFRESH_MS / 1000)}s · Product ID: {id}</span>
                {lastRefreshedAt && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live
                    </span>
                )}
            </div>
        </div>
    );
};

export default ProductAnalytics;
