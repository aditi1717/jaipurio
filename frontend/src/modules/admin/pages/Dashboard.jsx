import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MdInventory,
    MdShoppingCart,
    MdLocalOffer,
    MdPeople,
    MdCategory,
    MdAttachMoney,
    MdTrendingUp,
    MdAddBox,
    MdWarning,
    MdAssignment,
    MdPersonAdd,
    MdAccessTime,
    MdChevronRight
} from 'react-icons/md';
import API from '../../../services/api';
import useSupportStore from '../store/supportStore';

const defaultSummary = {
    metrics: {
        totalProducts: 0,
        totalOrders: 0,
        totalUsers: 0,
        totalCategories: 0,
        activeCoupons: 0,
        totalStockUnits: 0,
        outOfStockProducts: 0
    },
    revenue: {
        todayRevenue: 0,
        monthRevenue: 0,
        previousMonthRevenue: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        todayOrdersCount: 0,
        revenueGrowthPct: 0
    },
    tasks: {
        pendingOrders: 0,
        pendingReturns: 0
    },
    lowStockProducts: [],
    recentActivity: [],
    topCustomers: []
};

const DashboardLoadingState = () => (
    <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="h-3 w-24 rounded-full bg-gray-200" />
                    <div className="mt-3 h-7 w-16 rounded-full bg-gray-300" />
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="h-3 w-28 rounded-full bg-gray-200" />
                    <div className="mt-3 h-7 w-24 rounded-full bg-gray-300" />
                    <div className="mt-3 h-3 w-32 rounded-full bg-gray-200" />
                </div>
            ))}
        </div>
    </div>
);

const formatMoney = (value) => `\u20B9${Math.round(Number(value) || 0).toLocaleString()}`;

const activityIconMap = {
    order: MdShoppingCart,
    user: MdPersonAdd,
    return: MdAssignment
};

const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
let dashboardSummaryCache = {
    data: null,
    fetchedAt: 0
};

const isDashboardCacheFresh = () => (
    dashboardSummaryCache.data &&
    (Date.now() - dashboardSummaryCache.fetchedAt) < DASHBOARD_CACHE_TTL_MS
);

const normalizeSummary = (data) => ({
    ...defaultSummary,
    ...data,
    metrics: { ...defaultSummary.metrics, ...(data?.metrics || {}) },
    revenue: { ...defaultSummary.revenue, ...(data?.revenue || {}) },
    tasks: { ...defaultSummary.tasks, ...(data?.tasks || {}) },
    lowStockProducts: Array.isArray(data?.lowStockProducts) ? data.lowStockProducts : [],
    recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
    topCustomers: Array.isArray(data?.topCustomers) ? data.topCustomers : []
});

const Dashboard = () => {
    const navigate = useNavigate();
    const supportRequests = useSupportStore((state) => state.supportRequests || []);
    const [summary, setSummary] = useState(() => (
        dashboardSummaryCache.data ? normalizeSummary(dashboardSummaryCache.data) : defaultSummary
    ));
    const [isLoading, setIsLoading] = useState(() => !dashboardSummaryCache.data);
    const [error, setError] = useState('');

    useEffect(() => {
        let isMounted = true;

        const fetchSummary = async () => {
            setIsLoading(!dashboardSummaryCache.data);
            setError('');

            try {
                const { data } = await API.get('/admin/dashboard-summary');
                if (!isMounted) return;
                dashboardSummaryCache = {
                    data,
                    fetchedAt: Date.now()
                };
                setSummary(normalizeSummary(data));
            } catch (fetchError) {
                if (!isMounted) return;
                setError(fetchError.response?.data?.message || 'Failed to load dashboard');
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        if (!isDashboardCacheFresh()) {
            fetchSummary();
        } else {
            setIsLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, []);

    const openTickets = supportRequests.filter((request) => request.status === 'OPEN').length;
    const pendingOrders = Number(summary.tasks.pendingOrders || 0);
    const pendingReturns = Number(summary.tasks.pendingReturns || 0);
    const recentActivity = summary.recentActivity || [];
    const lowStockProducts = summary.lowStockProducts || [];
    const topCustomers = summary.topCustomers || [];

    if (isLoading) {
        return <DashboardLoadingState />;
    }

    if (error) {
        return (
            <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-red-500 shadow-sm">
                    <MdWarning size={28} />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">Could not load dashboard</p>
                <p className="mt-2 text-sm font-medium text-red-700">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div>
                <h1 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight">Dashboard Overview</h1>
                <p className="text-gray-500 mt-2 font-medium">Welcome back! Here's what's happening today.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div
                    onClick={() => navigate('/admin/products')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
                >
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Products</p>
                        <h3 className="text-xl font-black text-gray-900">{Number(summary.metrics.totalProducts || 0).toLocaleString()}</h3>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                        <MdInventory size={24} />
                    </div>
                </div>

                <div
                    onClick={() => navigate('/admin/orders')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
                >
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Orders</p>
                        <h3 className="text-xl font-black text-gray-900">{Number(summary.metrics.totalOrders || 0).toLocaleString()}</h3>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                        <MdShoppingCart size={24} />
                    </div>
                </div>

                <div
                    onClick={() => navigate('/admin/users')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
                >
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Users</p>
                        <h3 className="text-xl font-black text-gray-900">{Number(summary.metrics.totalUsers || 0).toLocaleString()}</h3>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                        <MdPeople size={24} />
                    </div>
                </div>

                <div
                    onClick={() => navigate('/admin/coupons')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
                >
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Active Coupons</p>
                        <h3 className="text-xl font-black text-gray-900">{Number(summary.metrics.activeCoupons || 0).toLocaleString()}</h3>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                        <MdLocalOffer size={24} />
                    </div>
                </div>

                <div
                    onClick={() => navigate('/admin/stock')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
                >
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Stock Units</p>
                        <h3 className="text-xl font-black text-gray-900">{Number(summary.metrics.totalStockUnits || 0).toLocaleString()}</h3>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                        <MdInventory size={24} />
                    </div>
                </div>

                <div
                    onClick={() => navigate('/admin/stock')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all cursor-pointer"
                >
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Out Of Stock</p>
                        <h3 className="text-xl font-black text-gray-900">{Number(summary.metrics.outOfStockProducts || 0).toLocaleString()}</h3>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                        <MdWarning size={24} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                    onClick={() => navigate('/admin/orders')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
                >
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Revenue</p>
                        <h3 className="text-xl font-black text-gray-900">{formatMoney(summary.revenue.totalRevenue)}</h3>
                        <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${Number(summary.revenue.revenueGrowthPct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <MdTrendingUp /> {Number(summary.revenue.revenueGrowthPct || 0) >= 0 ? '+' : ''}{Math.round(Number(summary.revenue.revenueGrowthPct || 0))}% vs last month
                        </p>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center">
                        <MdAttachMoney size={24} />
                    </div>
                </div>
                <div
                    onClick={() => navigate('/admin/orders')}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-all cursor-pointer"
                >
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Today's Sales</p>
                        <h3 className="text-xl font-black text-gray-900">{formatMoney(summary.revenue.todayRevenue)}</h3>
                        <p className="text-xs font-medium text-gray-500 mt-1">
                            {Number(summary.revenue.todayOrdersCount || 0)} orders today
                        </p>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center">
                        <MdAttachMoney size={24} />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Avg. Order Value</p>
                        <h3 className="text-xl font-black text-gray-900">{formatMoney(summary.revenue.avgOrderValue)}</h3>
                    </div>
                    <div className="w-10 h-10 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center">
                        <MdCategory size={24} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-gray-800 rounded-xl p-4 text-white shadow-lg shadow-gray-200">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <MdAccessTime className="text-gray-300" /> Quick Actions
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => navigate('/admin/products')} className="bg-white/10 hover:bg-white/20 transition p-2 rounded-lg flex flex-col items-center justify-center gap-2 text-xs font-bold border border-white/10">
                                    <MdAddBox size={24} className="text-gray-200" />
                                    Add Product
                                </button>
                                <button onClick={() => navigate('/admin/coupons')} className="bg-white/10 hover:bg-white/20 transition p-2 rounded-lg flex flex-col items-center justify-center gap-2 text-xs font-bold border border-white/10">
                                    <MdLocalOffer size={24} className="text-gray-200" />
                                    Create Coupon
                                </button>
                                <button onClick={() => navigate('/admin/categories')} className="bg-white/10 hover:bg-white/20 transition p-2 rounded-lg flex flex-col items-center justify-center gap-2 text-xs font-bold border border-white/10">
                                    <MdCategory size={24} className="text-gray-200" />
                                    Add Category
                                </button>
                                <button onClick={() => navigate('/admin/support')} className="bg-white/10 hover:bg-white/20 transition p-2 rounded-lg flex flex-col items-center justify-center gap-2 text-xs font-bold border border-white/10">
                                    <MdPeople size={24} className="text-gray-200" />
                                    View Users
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                            <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                                <MdAssignment className="text-gray-400" /> Pending Tasks
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 mb-2 cursor-pointer hover:bg-gray-100 transition" onClick={() => navigate('/admin/orders?status=Pending')}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs ring-2 ring-white">
                                            {pendingOrders}
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">Orders to Process</span>
                                    </div>
                                    <MdChevronRight className="text-gray-400" />
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 mb-2 cursor-pointer hover:bg-gray-100 transition" onClick={() => navigate('/admin/returns')}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs ring-2 ring-white">
                                            {pendingReturns}
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">Returns Pending</span>
                                    </div>
                                    <MdChevronRight className="text-gray-400" />
                                </div>
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition" onClick={() => navigate('/admin/support')}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs ring-2 ring-white">
                                            {openTickets}
                                        </div>
                                        <span className="text-sm font-bold text-gray-700">Support Tickets</span>
                                    </div>
                                    <MdChevronRight className="text-gray-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-lg text-gray-800">Recent Activity</h3>
                            <button
                                onClick={() => navigate('/admin/orders')}
                                className="text-xs font-bold text-gray-600 hover:bg-gray-50 px-3 py-1 border border-gray-200 rounded-full transition"
                            >
                                View All Orders
                            </button>
                        </div>
                        <div className="relative pl-2 space-y-6">
                            <div className="absolute top-2 left-[19px] bottom-2 w-0.5 bg-gray-100"></div>

                            {recentActivity.map((activity, index) => {
                                const ActivityIcon = activityIconMap[activity.type] || MdAssignment;
                                return (
                                    <div
                                        key={`${activity.type}-${activity.id || index}`}
                                        onClick={() => {
                                            if (activity.type === 'order') navigate(`/admin/orders/${activity.id}`);
                                            else if (activity.type === 'user') navigate(`/admin/users/${activity.id}`);
                                            else if (activity.type === 'return') navigate('/admin/returns');
                                        }}
                                        className="relative flex items-start gap-4 z-10 cursor-pointer group"
                                    >
                                        <div className="w-10 h-10 rounded-full flex items-center justify-center ring-4 ring-white bg-gray-50 text-gray-600 shrink-0 group-hover:bg-gray-100 transition-colors">
                                            <ActivityIcon size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 group-hover:text-primary-600 transition-colors">{activity.text}</p>
                                            <p className="text-xs text-gray-400 font-medium mt-0.5">{new Date(activity.time).toLocaleString()}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <MdWarning className="text-gray-500" size={20} />
                            <h3 className="font-bold text-lg text-gray-800">Low Stock Alert</h3>
                        </div>
                        <div className="space-y-3">
                            {lowStockProducts.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No low stock items.</p>
                            ) : (
                                lowStockProducts.map((product) => (
                                    <div
                                        key={product.id}
                                        onClick={() => navigate(`/admin/products/edit/${product.id}`)}
                                        className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100 transition"
                                    >
                                        <img src={product.image} alt={product.name} className="w-10 h-10 rounded-lg object-cover bg-white" />
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-xs font-bold text-gray-800 truncate">{product.name}</h4>
                                            <p className="text-[10px] text-gray-500">Stock: <span className="text-red-600 font-black">{product.computedStock} left</span></p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <MdPeople className="text-gray-500" size={20} />
                            <h3 className="font-bold text-lg text-gray-800">Top Customers</h3>
                        </div>
                        <div className="space-y-4">
                            {topCustomers.map((customer, index) => (
                                <div
                                    key={`${customer.id || customer.email || index}`}
                                    onClick={() => customer.id && navigate(`/admin/users/${customer.id}`)}
                                    className={`flex items-center justify-between border-b border-gray-50 last:border-0 pb-3 last:pb-0 ${customer.id ? 'cursor-pointer group' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center font-bold text-xs uppercase group-hover:bg-gray-100 transition-colors">
                                            {String(customer.name || 'CU').substring(0, 2)}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-800 group-hover:text-primary-600 transition-colors">{customer.name}</h4>
                                            <p className="text-[10px] text-gray-400">{Number(customer.orders || 0)} orders</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-gray-900">{formatMoney(customer.spend)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
