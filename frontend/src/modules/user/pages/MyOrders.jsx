import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import Pagination from '../../../components/Pagination';
import { getFulfillmentMode } from '../../../utils/shippingProvider';

const MyOrders = () => {
    const navigate = useNavigate();
    
    const [orders, setOrders] = useState([]);
    const [liveStatuses, setLiveStatuses] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    const ordersPerPage = 5;

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            setError(null);
            const { data } = await API.get('/orders/myorders');
            const ordersList = Array.isArray(data) ? data : [];
            setOrders(ordersList);
            setCurrentPage(1);
            setLoading(false);

            // Fetch live statuses asynchronously in the background so it doesn't block rendering of orders.
            const trackingPromises = ordersList.map(async (order) => {
                const fulfillmentMode = getFulfillmentMode(order);
                const trackingIdentifier = fulfillmentMode === 'delhivery'
                    ? order?.delhivery?.waybill
                    : order?.ekart?.trackingNumber;
                if (!['delhivery', 'ekart'].includes(fulfillmentMode) || !trackingIdentifier) {
                    return [String(order?._id || ''), ''];
                }

                try {
                    const { data: trackingResponse } = await API.get(`/orders/${order._id}/shipping-tracking`);
                    return [String(order._id), String(trackingResponse?.tracking?.currentStatus || '').trim()];
                } catch (trackingError) {
                    return [String(order._id), ''];
                }
            });

            const liveStatusEntries = await Promise.allSettled(trackingPromises);
            const statusMap = {};
            liveStatusEntries.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    const [id, status] = result.value;
                    statusMap[id] = status;
                } else {
                    const order = ordersList[idx];
                    if (order) {
                        statusMap[String(order._id || '')] = '';
                    }
                }
            });
            setLiveStatuses(statusMap);
        } catch (err) {
            console.error('Fetch orders error:', err);
            setError(err.response?.data?.message || 'Failed to fetch orders');
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'Confirmed': 'bg-primary-100 text-primary-800 border-primary-200',
            'Packed': 'bg-indigo-100 text-indigo-800 border-indigo-200',
            'Manifested': 'bg-indigo-100 text-indigo-800 border-indigo-200',
            'Not Picked': 'bg-slate-100 text-slate-800 border-slate-200',
            'Picked Up': 'bg-cyan-100 text-cyan-800 border-cyan-200',
            'Scheduled': 'bg-sky-100 text-sky-800 border-sky-200',
            'Dispatched': 'bg-purple-100 text-purple-800 border-purple-200',
            'In Transit': 'bg-violet-100 text-violet-800 border-violet-200',
            'Out for Delivery': 'bg-orange-100 text-orange-800 border-orange-200',
            'Delivered': 'bg-green-100 text-green-800 border-green-200',
            'Collected': 'bg-green-100 text-green-800 border-green-200',
            'Cancelled': 'bg-red-100 text-red-800 border-red-200',
            'RTO': 'bg-red-100 text-red-800 border-red-200',
            'DTO': 'bg-red-100 text-red-800 border-red-200',
            'Return Requested': 'bg-orange-100 text-orange-800 border-orange-200',
            'Replacement Requested': 'bg-orange-100 text-orange-800 border-orange-200',
            'Approved': 'bg-teal-100 text-teal-800 border-teal-200',
            'Pickup Scheduled': 'bg-purple-100 text-purple-800 border-purple-200',
            'Received at Warehouse': 'bg-primary-100 text-primary-800 border-primary-200',
            'Refund Initiated': 'bg-green-100 text-green-800 border-green-200',
            'Replacement Dispatched': 'bg-purple-100 text-purple-800 border-purple-200',
            'Returned': 'bg-green-100 text-green-800 border-green-200',
            'Replaced': 'bg-green-100 text-green-800 border-green-200',
            'Return Rejected': 'bg-red-100 text-red-800 border-red-200'
        };
        return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getStatusIcon = (status) => {
        const icons = {
            'Pending': 'pending',
            'Confirmed': 'check_circle',
            'Packed': 'inventory_2',
            'Manifested': 'inventory_2',
            'Not Picked': 'schedule',
            'Picked Up': 'inventory_2',
            'Scheduled': 'event',
            'Dispatched': 'local_shipping',
            'In Transit': 'sync_alt',
            'Out for Delivery': 'delivery_dining',
            'Delivered': 'done_all',
            'Collected': 'done_all',
            'Cancelled': 'cancel',
            'RTO': 'keyboard_return',
            'DTO': 'assignment_return',
            'Return Requested': 'assignment_return',
            'Replacement Requested': 'sync',
            'Approved': 'thumb_up',
            'Pickup Scheduled': 'local_shipping',
            'Received at Warehouse': 'warehouse',
            'Refund Initiated': 'currency_rupee',
            'Replacement Dispatched': 'local_shipping',
            'Returned': 'check_circle',
            'Replaced': 'check_circle',
            'Return Rejected': 'cancel'
        };
        return icons[status] || 'info';
    };

    const getEffectiveOrderStatus = (order) => {
        const liveStatus = String(liveStatuses[String(order?._id || '')] || '').trim();
        const fulfillmentMode = getFulfillmentMode(order);
        if (fulfillmentMode === 'manual' || fulfillmentMode === 'unassigned') {
            return String(order?.status || '').trim();
        }
        return liveStatus || String(order?.status || '').trim();
    };

    const totalPages = Math.ceil(orders.length / ordersPerPage);
    const startIndex = (currentPage - 1) * ordersPerPage;
    const paginatedOrders = orders.slice(startIndex, startIndex + ordersPerPage);

    const handlePageChange = (page) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-primary-50 via-white to-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-semibold">Loading your orders...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-primary-50 via-white to-gray-50 pb-24 md:pb-6">
            {/* Mobile Header */}
            <div className="hidden bg-gradient-to-r from-primary-600 to-purple-600 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10 md:hidden shadow-lg">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => navigate('/account')}
                        className="material-icons p-2 -ml-2 active:bg-white/10 rounded-full transition-all cursor-pointer relative z-20"
                    >
                        arrow_back
                    </button>
                    <h1 className="text-lg font-bold">My Orders</h1>
                </div>
                <button className="material-icons text-white">search</button>
            </div>

            {/* Desktop Container */}
            <div className="md:max-w-6xl md:mx-auto md:px-4">
                {/* Desktop Breadcrumbs */}
                <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 mt-2 mb-6">
                    <span onClick={() => navigate('/')} className="cursor-pointer hover:text-primary-600 font-medium">Home</span>
                    <span className="material-icons text-xs">chevron_right</span>
                    <span onClick={() => navigate('/account')} className="cursor-pointer hover:text-primary-600 font-medium">My Account</span>
                    <span className="material-icons text-xs">chevron_right</span>
                    <span className="bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent font-bold">My Orders</span>
                </div>

                {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6 mx-4 md:mx-0">
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-red-600">error</span>
                            <p className="text-red-700 font-semibold">{error}</p>
                        </div>
                    </div>
                )}

                {!loading && orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-10 text-center bg-white mx-4 md:mx-0 rounded-xl shadow-lg border border-primary-100">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-indigo-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-8 ring-indigo-50/50">
                            <span className="material-icons text-indigo-600 text-6xl md:text-7xl">receipt_long</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-gray-800">You haven't placed any orders yet!</h2>
                        <p className="text-gray-600 text-base mb-6">Start shopping to see your orders here.</p>
                        <button onClick={() => navigate('/')} className="bg-gradient-to-r from-primary-600 to-purple-600 text-white px-12 py-3.5 rounded-lg font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                            Shop Now
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 px-4 md:px-0">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">Order History</h2>
                                <p className="text-sm text-gray-500">
                                    Showing {startIndex + 1}-{Math.min(startIndex + paginatedOrders.length, orders.length)} of {orders.length} orders
                                </p>
                            </div>
                        </div>

                        {paginatedOrders.map((order) => {
                            const effectiveStatus = getEffectiveOrderStatus(order);
                            return (
                            <div 
                                key={order._id} 
                                className="bg-white rounded-lg shadow-md border-2 border-primary-100 overflow-hidden hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-1"
                                onClick={() => navigate(`/my-orders/${order._id}`)}
                            >
                                {/* Order Header */}
                                <div className="bg-gradient-to-r from-white to-primary-50 px-5 py-4 border-b border-primary-100">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="material-icons text-primary-600 text-2xl">receipt_long</span>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium">Order ID</p>
                                                <p className="font-bold text-gray-800 text-sm">#{order.displayId || order._id.slice(-8).toUpperCase()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium">Placed on</p>
                                                <p className="font-semibold text-gray-800 text-sm">
                                                    {new Date(order.createdAt).toLocaleDateString('en-IN', { 
                                                        day: 'numeric', 
                                                        month: 'short', 
                                                        year: 'numeric' 
                                                    })}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 ${getStatusColor(effectiveStatus)}`}>
                                                <span className="material-icons text-sm">{getStatusIcon(effectiveStatus)}</span>
                                                {effectiveStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="p-5">
                                    <div className="space-y-3">
                                        {order.orderItems.slice(0, 3).map((item, index) => (
                                            <div key={index} className="flex gap-4 items-center">
                                                <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-gray-50 to-primary-50 rounded-lg border-2 border-primary-100 p-2 flex-shrink-0">
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-bold text-gray-800 line-clamp-2">{item.name}</h3>
                                                    {item.variant && (
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                                            {Object.entries(item.variant).map(([key, value]) => (
                                                                <span key={key} className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                                                    {key}: <span className="text-primary-600">{value}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="text-base font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mt-1">
                                                        ₹{item.price.toLocaleString()}
                                                    </p>

                                                    {/* Serial Number / IMEI - Only if Delivered */}
                                                    {(item.serialNumber && (effectiveStatus === 'Delivered' || order.isDelivered)) && (
                                                        <div className="mt-2">
                                                            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-md font-bold font-mono border border-primary-200 shadow-sm flex items-center gap-1 w-max">
                                                                <span className="text-primary-400 select-none">{item.serialType === 'IMEI' ? 'IMEI:' : 'SN:'}</span> {item.serialNumber}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Item Status Badge */}
                                                    {item.status && item.status !== effectiveStatus && (
                                                        <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(item.status)}`}>
                                                            <span className="material-icons text-[12px]">{getStatusIcon(item.status)}</span>
                                                            {item.status}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {order.orderItems.length > 3 && (
                                            <p className="text-xs text-primary-600 font-bold">
                                                +{order.orderItems.length - 3} more item(s)
                                            </p>
                                        )}
                                    </div>

                                    {/* Order Total */}
                                    <div className="mt-4 pt-4 border-t border-primary-100 flex flex-col md:flex-row justify-between md:items-center gap-3">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
                                            <p className="text-xl font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                                                ₹{order.totalPrice.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {order.isPaid ? (
                                                <div className="flex items-center gap-1 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                                                    <span className="material-icons text-green-600 text-sm">check_circle</span>
                                                    <span className="text-xs font-bold text-green-700">Paid</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-full">
                                                    <span className="material-icons text-yellow-600 text-sm">pending</span>
                                                    <span className="text-xs font-bold text-yellow-700">COD</span>
                                                </div>
                                            )}
                                            <button 
                                                className="flex items-center gap-1 bg-gradient-to-r from-primary-600 to-purple-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:shadow-lg transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/my-orders/${order._id}`);
                                                }}
                                            >
                                                View Details
                                                <span className="material-icons text-sm">arrow_forward</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )})}

                        <Pagination
                            pages={totalPages}
                            page={currentPage}
                            changePage={handlePageChange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyOrders;
