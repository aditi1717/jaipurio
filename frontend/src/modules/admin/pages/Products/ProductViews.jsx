import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdRefresh, MdSearch, MdVisibility, MdBarChart, MdPeople, MdTimeline, MdToday, MdCategory } from 'react-icons/md';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip, 
    ResponsiveContainer, 
    Cell,
    CartesianGrid,
    AreaChart,
    Area
} from 'recharts';
import { motion } from 'framer-motion';
import API from '../../../../services/api';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';
import { DATE_RANGE_PRESETS, resolveDateRange } from '../../components/orders/orderDateRange';

const getProductId = (product) => String(product?.id || product?._id || '');
const ITEMS_PER_PAGE = 20;
const LIVE_REFRESH_MS = 15000;
const INDIA_TIME_ZONE = 'Asia/Kolkata';
const isKnownState = (value) => String(value || '').trim().toLowerCase() !== 'unknown';
const getKnownStateEntries = (product) => (
    (Array.isArray(product?.viewStatsByState) ? product.viewStatsByState : [])
        .map((entry) => ({
            state: String(entry?.state || '').trim() || 'Unknown',
            count: Number(entry?.count || 0)
        }))
        .filter((entry) => entry.count > 0 && isKnownState(entry.state))
        .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
);

const getIndiaDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(date);

const formatDateLabel = (dateKey) => {
    if (!dateKey) return '';
    return new Date(`${dateKey}T00:00:00+05:30`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: INDIA_TIME_ZONE
    });
};

const MotionDiv = motion.div;

const getFriendlyPathLabel = (path = '') => {
    if (path === '/') return 'Home';
    if (path === '/cart') return 'Cart';
    if (path === '/checkout') return 'Checkout';
    if (path === '/my-orders') return 'My Orders';
    if (path === '/wishlist') return 'Wishlist';
    if (path === '/addresses') return 'Addresses';
    if (path === '/categories') return 'Categories';
    if (path.includes('/product/')) return 'Product Details';
    if (path.includes('/category/')) return 'Category Page';
    if (path === '/login') return 'Login';
    if (path === '/become-seller') return 'Become Seller';
    if (path === '/play') return 'Quiz Play';
    if (path === '/help-center') return 'Help Center';
    const lastSegment = path.split('/').filter(Boolean).pop();
    if (lastSegment) {
        return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/-/g, ' ');
    }
    return path;
};

const ProductViews = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [portalInsights, setPortalInsights] = useState(null);
    const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
    const [portalInsightsError, setPortalInsightsError] = useState(false);
    const [dateRange, setDateRange] = useState('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const isFetchingRef = useRef(false);
    // Auto-refresh timers are set up once, so they read the range from a ref.
    const rangeRef = useRef({ startDate: '', endDate: '' });
    rangeRef.current = resolveDateRange(dateRange, customStart, customEnd);
    const { startDate, endDate } = rangeRef.current;
    const isRangeScoped = Boolean(startDate || endDate);

    const fetchProducts = async (showToast = false) => {
        if (isFetchingRef.current) {
            return;
        }

        try {
            isFetchingRef.current = true;
            setLoading(true);
            const params = {};
            if (rangeRef.current.startDate) params.startDate = rangeRef.current.startDate;
            if (rangeRef.current.endDate) params.endDate = rangeRef.current.endDate;
            const [productsResult, portalResult] = await Promise.allSettled([
                API.get('/products/view-insights/products', { params }),
                // Same window drives the portal-wide cards, charts and funnel.
                API.get('/products/view-insights/portal', { params })
            ]);

            if (productsResult.status === 'fulfilled') {
                const { data } = productsResult.value;
                const list = Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []);
                const sorted = [...list].sort((a, b) => Number(b.viewCount || 0) - Number(a.viewCount || 0));
                setProducts(sorted);
            } else {
                throw productsResult.reason;
            }

            if (portalResult.status === 'fulfilled') {
                setPortalInsights(portalResult.value.data);
                setPortalInsightsError(false);
            } else {
                console.error('Error fetching portal insights:', portalResult.reason);
                setPortalInsightsError(true);
            }

            setLastRefreshedAt(new Date());
            if (showToast) {
                if (portalResult.status === 'fulfilled') {
                    toast.success('Views refreshed');
                } else {
                    toast.success('Products refreshed');
                }
            }
        } catch (error) {
            console.error('Error fetching product views:', error);
            toast.error('Failed to load product views');
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
        setCurrentPage(1);
    }, [startDate, endDate]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') {
                return;
            }
            fetchProducts();
        }, LIVE_REFRESH_MS);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchProducts();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const filteredProducts = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return products;

        return products.filter((product) =>
            String(product?.name || '').toLowerCase().includes(query) ||
            String(product?.brand || '').toLowerCase().includes(query) ||
            String(product?.category || '').toLowerCase().includes(query)
        );
    }, [products, searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const totalViews = filteredProducts.reduce((sum, product) => sum + Number(product?.viewCount || 0), 0);
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const totalPortalVisitors = Number(portalInsights?.totalVisitors || 0);
    const last7DaysVisitors = Number(
        (isRangeScoped ? portalInsights?.rangeTotals?.visitors : portalInsights?.last7Days?.visitors) || 0
    );
    const liveLoggedInUsers = Number(portalInsights?.authStats?.activeLoggedInUsers || 0);
    const liveActiveAllUsers = Number(portalInsights?.authStats?.liveActiveAllUsers || 0);
    const todayLogins = Number(portalInsights?.authStats?.todayLogins || 0);
    const todayLogouts = Number(portalInsights?.authStats?.todayLogouts || 0);
    const liveWindowMinutes = Number(portalInsights?.authStats?.liveWindowMinutes || 5);
    const todayDateKey = getIndiaDateKey();
    const todayVisitors = Number(
        (portalInsights?.dailyStats || []).find((entry) => entry?.date === todayDateKey)?.visitors || 0
    );
    const avgDailyVisitors = portalInsights?.dailyStats?.length
        ? Math.round(
            (portalInsights.dailyStats.reduce((sum, entry) => sum + Number(entry?.visitors || 0), 0)) /
            portalInsights.dailyStats.length
        )
        : 0;
    const trendChartData = (portalInsights?.dailyStats || []).map((entry) => ({
        ...entry,
        label: formatDateLabel(entry.date)
    }));
    const weeklyDistribution = portalInsights?.weeklyDistribution || [];
    const busiestDayLabel = portalInsights?.busiestDay?.date
        ? new Date(`${portalInsights.busiestDay.date}T00:00:00+05:30`).toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: INDIA_TIME_ZONE
        })
        : 'No data yet';
    const uniqueStatesCount = useMemo(() => {
        const stateSet = new Set();
        filteredProducts.forEach((product) => {
            getKnownStateEntries(product).forEach((entry) => stateSet.add(entry.state));
        });
        return stateSet.size;
    }, [filteredProducts]);
    const topTrafficStates = useMemo(() => {
        const totals = new Map();
        filteredProducts.forEach((product) => {
            getKnownStateEntries(product).forEach((entry) => {
                totals.set(entry.state, (totals.get(entry.state) || 0) + entry.count);
            });
        });
        return Array.from(totals.entries())
            .map(([state, count]) => ({ state, count }))
            .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
            .slice(0, 5);
    }, [filteredProducts]);

    const handleViewInsights = (product) => {
        navigate(`/admin/product-views/${getProductId(product)}`);
    };

    if (loading && !portalInsights) {
        return (
            <div className="flex min-h-[450px] flex-col items-center justify-center space-y-4 py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
                <div className="text-center">
                    <h3 className="text-base font-black text-gray-900 animate-pulse">Calculating Insights...</h3>
                    <p className="mt-1 text-xs font-semibold text-gray-400 uppercase tracking-widest">Aggregating live visitor traffic and funnel stats</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Product Views</h1>
                    <p className="text-sm text-gray-500 font-medium italic">
                        Track product traffic and live logged-in user activity
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-primary-400 focus:bg-white"
                    >
                        {DATE_RANGE_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>{preset.label}</option>
                        ))}
                    </select>
                    {dateRange === 'custom' && (
                        <>
                            <input
                                type="date"
                                value={customStart}
                                max={customEnd || undefined}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-primary-400 focus:bg-white"
                            />
                            <span className="text-xs font-black text-gray-400">to</span>
                            <input
                                type="date"
                                value={customEnd}
                                min={customStart || undefined}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-primary-400 focus:bg-white"
                            />
                        </>
                    )}
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => fetchProducts(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-70 transition-opacity"
                    >
                        <MdRefresh size={18} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'Calculating...' : 'Refresh'}
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Tracked Products</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{filteredProducts.length}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                        {isRangeScoped ? 'Views In Range' : 'Total Views'}
                    </p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{totalViews.toLocaleString()}</p>
                    {isRangeScoped && (
                        <p className="mt-1 text-xs font-semibold text-gray-500">{startDate || 'start'} → {endDate || 'today'}</p>
                    )}
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Top Product</p>
                    <p className="mt-2 line-clamp-2 text-lg font-black text-gray-900">
                        {filteredProducts[0]?.name || 'No data yet'}
                    </p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">Different States</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{uniqueStatesCount}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Products viewed from these states</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-600 text-white">
                        <MdPeople size={22} />
                    </div>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-500">Live Active Users</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{liveActiveAllUsers.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">{liveLoggedInUsers} logged in · {liveWindowMinutes}min window</p>
                </div>
                <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 to-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white">
                        <MdPeople size={22} />
                    </div>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-primary-500">
                        {isRangeScoped ? 'Visitors In Range' : 'Portal Visitors'}
                    </p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{totalPortalVisitors.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Tracked across guest and logged-in portal sessions</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                        <MdToday size={22} />
                    </div>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-emerald-500">Today's Logins</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{todayLogins.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">New authenticated user sessions today</p>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white">
                        <MdTimeline size={22} />
                    </div>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-violet-500">Today's Visitors</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{todayVisitors.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Actual portal visitors recorded for today</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
                        <MdBarChart size={22} />
                    </div>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-amber-600">
                        {isRangeScoped ? 'Selected Range' : 'Last 7 Days'}
                    </p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{last7DaysVisitors.toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Recent visitor movement across the portal</p>
                </div>
            </div>

            {portalInsightsError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                    Portal analytics are taking too long right now, so this page is showing product view data first and will keep retrying the live insights in the background.
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/20 to-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">Average Pages Visited</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{(portalInsights?.engagementStats?.avgPageDepth || 1.0).toLocaleString()} pages</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Average number of pages navigated per session</p>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/20 to-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Average Session Duration</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{(portalInsights?.engagementStats?.avgSessionDurationMin || 0).toLocaleString()} mins</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Average active time spent per visitor session</p>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/20 to-white p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">Bounce Rate</p>
                    <p className="mt-2 text-3xl font-black text-gray-900">{(portalInsights?.engagementStats?.bounceRate || 0).toLocaleString()}%</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">Percentage of sessions with only single page views</p>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-xs font-semibold text-gray-500 shadow-sm flex items-center justify-between gap-4 flex-wrap">
                <span>Auto-refreshing every {Math.round(LIVE_REFRESH_MS / 1000)}s · Busiest day: {busiestDayLabel} · Avg daily visitors: {avgDailyVisitors.toLocaleString()} · Today's logouts: {todayLogouts.toLocaleString()}</span>
                {lastRefreshedAt && (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Last synced: {lastRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                )}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
                <MotionDiv
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-gray-900">Portal Visit Trend</h3>
                            <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-gray-400">
                                Daily portal visitors and page activity
                            </p>
                        </div>
                        <MdTimeline className="text-primary-500" size={24} />
                    </div>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="portalVisitorsFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                                    </linearGradient>
                                    <linearGradient id="portalViewsFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={18}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={36}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value, name) => [`${Number(value || 0).toLocaleString()}`, name === 'visitors' ? 'Visitors' : 'Views']}
                                />
                                <Area type="monotone" dataKey="views" stroke="#14b8a6" fill="url(#portalViewsFill)" strokeWidth={2} />
                                <Area type="monotone" dataKey="visitors" stroke="#2563eb" fill="url(#portalVisitorsFill)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </MotionDiv>

                <MotionDiv
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                    <div className="mb-6">
                        <h3 className="text-lg font-black text-gray-900">Weekly Distribution</h3>
                        <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-gray-400">
                            Which weekdays bring the most portal visitors
                        </p>
                    </div>
                    <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyDistribution} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                                <YAxis hide />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value, name) => [`${Number(value || 0).toLocaleString()}`, name === 'visitors' ? 'Visitors' : 'Views']}
                                />
                                <Bar dataKey="visitors" radius={[10, 10, 0, 0]} barSize={26}>
                                    {weeklyDistribution.map((entry, index) => (
                                        <Cell key={`${entry.day}-${index}`} fill={['#2563eb', '#3b82f6', '#60a5fa', '#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b'][index % 7]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                        {weeklyDistribution.map((entry) => (
                            <div key={entry.day} className="flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2">
                                <span className="text-xs font-black uppercase tracking-widest text-gray-500">{entry.day}</span>
                                <div className="text-right">
                                    <div className="text-sm font-black text-gray-900">{Number(entry.visitors || 0).toLocaleString()} visitors</div>
                                    <div className="text-[11px] font-semibold text-gray-400">{Number(entry.views || 0).toLocaleString()} views</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </MotionDiv>
            </div>

            {/* Acquisition and Regional traffic */}
            <div className="grid gap-6 xl:grid-cols-2">
                {/* Traffic From Different States */}
                <MotionDiv
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between"
                >
                    <div>
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-gray-900">Traffic From Different States</h3>
                                <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-gray-400">
                                    Top states sending product-page traffic
                                </p>
                            </div>
                        </div>
                        {topTrafficStates.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {topTrafficStates.map((entry, index) => (
                                    <div key={entry.state} className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">#{index + 1} State</div>
                                        <div className="mt-2 text-base font-black text-gray-900 truncate" title={entry.state}>{entry.state}</div>
                                        <div className="mt-1 text-sm font-bold text-primary-600">{entry.count.toLocaleString()} views</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm font-semibold text-gray-400">
                                No state-level traffic data yet.
                            </div>
                        )}
                    </div>
                </MotionDiv>

                {/* Top Referral Sources */}
                <MotionDiv
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm flex flex-col justify-between"
                >
                    <div>
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-gray-900">Top Referral Sources</h3>
                                <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-gray-400">
                                    Where your portal visitors are arriving from
                                </p>
                            </div>
                        </div>
                        {portalInsights?.referrerDistribution && portalInsights.referrerDistribution.length > 0 ? (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {portalInsights.referrerDistribution.map((entry, index) => (
                                    <div key={entry.name} className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">#{index + 1} Source</div>
                                        <div className="mt-2 text-base font-black text-gray-900 truncate" title={entry.name}>{entry.name}</div>
                                        <div className="mt-1 text-sm font-bold text-emerald-600">{entry.value.toLocaleString()} sessions</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm font-semibold text-gray-400">
                                No referral tracking data yet.
                            </div>
                        )}
                    </div>
                </MotionDiv>
            </div>

            {/* Funnel Conversion Analysis */}
            <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
            >
                <div className="mb-6">
                    <h3 className="text-lg font-black text-gray-900">Purchase Funnel Conversion</h3>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-widest text-gray-400">
                        Conversion rates from visitor touch to successful purchase
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-5">
                    {/* Step 1: Sessions */}
                    <div className="relative rounded-2xl bg-gray-50/50 p-4 border border-gray-100">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Step 1</div>
                        <div className="mt-2 text-xl font-black text-gray-900">{(portalInsights?.conversionFunnel?.totalSessions || 0).toLocaleString()}</div>
                        <div className="mt-1 text-xs font-semibold text-gray-600">Total Visits</div>
                        <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-primary-500" style={{ width: '100%' }}></div>
                        </div>
                        <div className="mt-1.5 text-[10px] font-bold text-primary-600">100% Benchmark</div>
                    </div>

                    {/* Step 2: Product Views */}
                    <div className="relative rounded-2xl bg-gray-50/50 p-4 border border-gray-100">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Step 2</div>
                        <div className="mt-2 text-xl font-black text-gray-900">{(portalInsights?.conversionFunnel?.viewedPdp || 0).toLocaleString()}</div>
                        <div className="mt-1 text-xs font-semibold text-gray-600">Product Views</div>
                        <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round(((portalInsights?.conversionFunnel?.viewedPdp || 0) / Math.max(portalInsights?.conversionFunnel?.totalSessions || 1, 1)) * 100)}%` }}></div>
                        </div>
                        <div className="mt-1.5 text-[10px] font-bold text-indigo-600">{Math.round(((portalInsights?.conversionFunnel?.viewedPdp || 0) / Math.max(portalInsights?.conversionFunnel?.totalSessions || 1, 1)) * 100)}% of visits</div>
                    </div>

                    {/* Step 3: Cart Visits */}
                    <div className="relative rounded-2xl bg-gray-50/50 p-4 border border-gray-100">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Step 3</div>
                        <div className="mt-2 text-xl font-black text-gray-900">{(portalInsights?.conversionFunnel?.visitedCart || 0).toLocaleString()}</div>
                        <div className="mt-1 text-xs font-semibold text-gray-600">Cart Adds</div>
                        <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.round(((portalInsights?.conversionFunnel?.visitedCart || 0) / Math.max(portalInsights?.conversionFunnel?.totalSessions || 1, 1)) * 100)}%` }}></div>
                        </div>
                        <div className="mt-1.5 text-[10px] font-bold text-amber-600">{Math.round(((portalInsights?.conversionFunnel?.visitedCart || 0) / Math.max(portalInsights?.conversionFunnel?.totalSessions || 1, 1)) * 100)}% of visits</div>
                    </div>

                    {/* Step 4: Checkout Entries */}
                    <div className="relative rounded-2xl bg-gray-50/50 p-4 border border-gray-100">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Step 4</div>
                        <div className="mt-2 text-xl font-black text-gray-900">{(portalInsights?.conversionFunnel?.initiatedCheckout || 0).toLocaleString()}</div>
                        <div className="mt-1 text-xs font-semibold text-gray-600">Checkout Initials</div>
                        <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.round(((portalInsights?.conversionFunnel?.initiatedCheckout || 0) / Math.max(portalInsights?.conversionFunnel?.totalSessions || 1, 1)) * 100)}%` }}></div>
                        </div>
                        <div className="mt-1.5 text-[10px] font-bold text-rose-600">{Math.round(((portalInsights?.conversionFunnel?.initiatedCheckout || 0) / Math.max(portalInsights?.conversionFunnel?.totalSessions || 1, 1)) * 100)}% of visits</div>
                    </div>

                    {/* Step 5: Purchases */}
                    <div className="relative rounded-2xl bg-gray-50/50 p-4 border border-gray-100">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Step 5</div>
                        <div className="mt-2 text-xl font-black text-gray-900">{(portalInsights?.conversionFunnel?.purchased || 0).toLocaleString()}</div>
                        <div className="mt-1 text-xs font-semibold text-gray-600">Purchases</div>
                        <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(((portalInsights?.conversionFunnel?.purchased || 0) / Math.max(portalInsights?.conversionFunnel?.totalSessions || 1, 1)) * 100)}%` }}></div>
                        </div>
                        <div className="mt-1.5 text-[10px] font-bold text-emerald-600">{Math.round(((portalInsights?.conversionFunnel?.purchased || 0) / Math.max(portalInsights?.conversionFunnel?.totalSessions || 1, 1)) * 100)}% conversion</div>
                    </div>
                </div>
            </MotionDiv>

            {/* Advanced Analytics Charts Grid */}
            <div className="grid gap-6 xl:grid-cols-2">
                {/* Page Category Distribution Chart */}
                <MotionDiv 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-gray-900">Page Category Traffic</h3>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-0.5">Traffic share across portal sections</p>
                        </div>
                        <MdCategory className="text-primary-500" size={24} />
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={portalInsights?.pageDistribution || []} 
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                                <YAxis hide />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [`${value} Views`, 'Views']}
                                />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={26}>
                                    {(portalInsights?.pageDistribution || []).map((entry, index) => (
                                        <Cell key={`cell-page-${index}`} fill={['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#6b7280'][index % 7]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </MotionDiv>

                {/* Popular Products Chart */}
                <MotionDiv 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black text-gray-900">Popular Products</h3>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-0.5">Top 10 most viewed items</p>
                        </div>
                        <MdBarChart className="text-primary-500" size={24} />
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={filteredProducts.slice(0, 10).map(p => ({ 
                                    name: p.name.length > 20 ? p.name.substring(0, 17) + '...' : p.name, 
                                    views: p.viewCount || 0,
                                    originalName: p.name 
                                }))} 
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                layout="vertical"
                            >
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    width={120}
                                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f8fafc' }}
                                    formatter={(value) => [`${value} Views`, 'Views']}
                                    labelStyle={{ display: 'none' }}
                                />
                                <Bar dataKey="views" radius={[0, 8, 8, 0]} barSize={20}>
                                    {filteredProducts.slice(0, 10).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button 
                            type="button"
                            onClick={() => navigate(`/admin/product-views/${getProductId(filteredProducts[0])}`)}
                            className="text-xs font-black text-primary-600 uppercase tracking-widest hover:underline"
                        >
                            View Full Stats
                        </button>
                    </div>
                </MotionDiv>
            </div>

            {/* Live & Recent Portal Activity */}
            <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
            >
                <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                            <span className="relative flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                            </span>
                            Live & Recent Portal Activity
                        </h3>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mt-0.5">
                            Real-time user session status, locations, and transition flows
                        </p>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-slate-900 text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">User</th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Auth Method</th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">State</th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Status / Last Seen</th>
                                    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Page Navigation Flow</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {portalInsights?.recentSessions && portalInsights.recentSessions.length > 0 ? (
                                    portalInsights.recentSessions.map((session) => {
                                        const now = new Date();
                                        const lastSeen = new Date(session.lastSeenAt);
                                        const isOnline = session.isActive && (now.getTime() - lastSeen.getTime() < 5 * 60 * 1000);
                                        const initials = session.user?.name
                                            ? session.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                            : 'U';
                                        
                                        return (
                                            <tr key={session.sessionId} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900">
                                                                {session.user?.name || 'Anonymous User'}
                                                            </p>
                                                            <p className="text-[11px] font-semibold text-gray-400">
                                                                {session.user?.email || session.user?.phone || 'No Contact Info'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black uppercase tracking-wider text-slate-700">
                                                        {session.authMethod || 'unknown'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-1.5 text-gray-900">
                                                        <span className="h-2.5 w-2.5 rounded-full bg-primary-500"></span>
                                                        <span className="text-sm font-black">{session.state || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        {isOnline ? (
                                                            <span className="flex items-center gap-1.5 text-xs font-black text-emerald-600">
                                                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                                Online
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-bold text-gray-400">
                                                                {new Date(session.lastSeenAt).toLocaleTimeString('en-IN', {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                })}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 max-w-[400px]">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {Array.isArray(session.pagesVisited) && session.pagesVisited.length > 0 ? (
                                                            session.pagesVisited.map((page, idx) => (
                                                                <React.Fragment key={idx}>
                                                                    {idx > 0 && <span className="text-gray-300 font-bold">→</span>}
                                                                    <span 
                                                                        title={new Date(page.visitedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                        className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-black tracking-wide border cursor-default transition-all duration-200 hover:scale-105 ${
                                                                            idx === session.pagesVisited.length - 1
                                                                                ? 'bg-primary-600 border-primary-600 text-white font-extrabold shadow-sm'
                                                                                : 'bg-white border-gray-200 text-gray-700 font-bold'
                                                                        }`}
                                                                    >
                                                                        {getFriendlyPathLabel(page.path)}
                                                                    </span>
                                                                </React.Fragment>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs font-semibold text-gray-400 italic">No pages logged yet</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="px-4 py-10 text-center text-sm text-gray-400">
                                            No active or recent user sessions recorded in the last 24 hours.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </MotionDiv>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="relative">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by product, brand, or category..."
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 outline-none transition focus:border-primary-400 focus:bg-white"
                    />
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                        <thead className="bg-slate-900 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Product</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Brand</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-widest">States (all time)</th>
                                <th className="px-4 py-3 text-center text-xs font-black uppercase tracking-widest">Details</th>
                                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-widest">Views</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-400">Loading product views...</td>
                                </tr>
                            ) : filteredProducts.length > 0 ? (
                                paginatedProducts.map((product) => {
                                    const stateEntries = getKnownStateEntries(product);
                                    const topState = stateEntries[0];

                                    return (
                                    <tr key={getProductId(product)} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-11 w-11 overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                                                    {product?.image ? (
                                                        <img src={product.image} alt={product?.name || ''} className="h-full w-full object-contain p-1" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                                                            <MdVisibility size={18} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-bold text-gray-900">{product?.name || 'Untitled product'}</p>
                                                    <p className="text-[11px] font-medium text-gray-400">ID: {product?.id || product?._id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{product?.brand || 'N/A'}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">{product?.category || 'N/A'}</td>
                                        <td className="px-4 py-3">
                                            {topState ? (
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-gray-900">{topState.state}</span>
                                                    <span className="text-[11px] font-semibold text-gray-400">
                                                        {stateEntries.length} state{stateEntries.length === 1 ? '' : 's'} tracked
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-sm font-semibold text-gray-400">No state data</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleViewInsights(product)}
                                                className="inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary-700 hover:bg-primary-100"
                                            >
                                                View
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-sm font-black text-primary-700">
                                                <MdVisibility size={16} />
                                                {Number(product?.viewCount || 0).toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                )})
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-400">No product views found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {!loading && totalPages > 1 && (
                    <Pagination
                        currentPage={safeCurrentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>

        </div>
    );
};

export default ProductViews;
