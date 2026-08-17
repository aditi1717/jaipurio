import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';

const Orders = () => {
    const navigate = useNavigate();
    
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const { data } = await API.get('/orders/myorders');
            setOrders(data);
            setError(null);
        } catch (err) {
            console.error('Fetch orders error:', err);
            setError(err.response?.data?.message || 'Failed to fetch orders');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
            'Processing': 'bg-primary-100 text-primary-800 border-primary-200',
            'Shipped': 'bg-purple-100 text-purple-800 border-purple-200',
            'Delivered': 'bg-green-100 text-green-800 border-green-200',
            'Cancelled': 'bg-red-100 text-red-800 border-red-200'
        };
        return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
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
        <div className="min-h-screen bg-gradient-to-b from-primary-50 via-white to-gray-50 pb-24">
            {/* Header */}
            <div className="bg-white sticky top-0 z-50 shadow-md border-b border-primary-100">
                <div className="px-4 py-4 flex items-center gap-3 max-w-6xl mx-auto">
                    <button
                        onClick={() => navigate(-1)}
                        className="material-icons p-2 -ml-2 active:bg-primary-50 rounded-full transition-all cursor-pointer text-primary-600 hover:bg-primary-100"
                    >
                        arrow_back
                    </button>
                    <div className="flex items-center gap-3">
                        <span className="material-icons text-primary-600 text-3xl">shopping_bag</span>
                        <h1 className="text-xl font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent md:text-3xl">
                            My Orders
                        </h1>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 py-6">
                {error && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2">
                            <span className="material-icons text-red-600">error</span>
                            <p className="text-red-700 font-semibold">{error}</p>
                        </div>
                    </div>
                )}

                {!loading && orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-10 text-center bg-white rounded-xl shadow-lg border border-primary-100">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-primary-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-8 ring-primary-50/50">
                            <span className="material-icons text-primary-600 text-6xl md:text-7xl">shopping_bag</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-2 text-gray-800">No orders yet!</h2>
                        <p className="text-gray-600 text-base mb-6">Start shopping to see your orders here.</p>
                        <button onClick={() => navigate('/')} className="bg-gradient-to-r from-primary-600 to-purple-600 text-white px-12 py-3.5 rounded-lg font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all">
                            Start Shopping
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <div 
                                key={order._id} 
                                className="bg-white rounded-lg shadow-md border-2 border-primary-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                                onClick={() => navigate(`/order/${order._id}`)}
                            >
                                {/* Order Header */}
                                <div className="bg-gradient-to-r from-white to-primary-50 px-5 py-4 border-b border-primary-100">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="material-icons text-primary-600 text-2xl">receipt_long</span>
                                            <div>
                                                <p className="text-xs text-gray-500 font-medium">Order ID</p>
                                                <p className="font-bold text-gray-800 text-sm">#{order._id.slice(-8).toUpperCase()}</p>
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
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="p-5">
                                    <div className="space-y-3">
                                        {order.orderItems.slice(0, 3).map((item, index) => (
                                            <div key={index} className="flex gap-4 items-center">
                                                <div className="w-16 h-16 bg-gradient-to-br from-gray-50 to-primary-50 rounded-lg border-2 border-primary-100 p-2 flex-shrink-0">
                                                    <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-bold text-gray-800 line-clamp-1">{item.name}</h3>
                                                    <p className="text-xs text-gray-500 mt-1">Quantity: {item.qty}</p>
                                                    <p className="text-base font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent mt-1">
                                                        ₹{item.price.toLocaleString()}
                                                    </p>
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
                                    <div className="mt-4 pt-4 border-t border-primary-100 flex justify-between items-center">
                                        <div>
                                            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
                                            <p className="text-xl font-extrabold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                                                ₹{order.totalPrice.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {order.isPaid ? (
                                                <div className="flex items-center gap-1 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                                                    <span className="material-icons text-green-600 text-sm">check_circle</span>
                                                    <span className="text-xs font-bold text-green-700">Paid</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-full">
                                                    <span className="material-icons text-yellow-600 text-sm">pending</span>
                                                    <span className="text-xs font-bold text-yellow-700">Unpaid</span>
                                                </div>
                                            )}
                                            <button 
                                                className="flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-primary-700 transition-colors"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/order/${order._id}`);
                                                }}
                                            >
                                                View Details
                                                <span className="material-icons text-sm">arrow_forward</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Orders;
