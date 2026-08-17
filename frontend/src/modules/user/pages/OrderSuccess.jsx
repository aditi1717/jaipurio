import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import API from '../../../services/api';

const OrderSuccess = () => {
    const navigate = useNavigate();
    const orders = useCartStore(state => state.orders);
    const latestOrder = orders[0];
    const [settings, setSettings] = React.useState(null);

    const startSimulation = useCartStore(state => state.startSimulation);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await API.get('/settings');
                setSettings(data);
            } catch (err) {
                console.error('Fetch settings error:', err);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        window.scrollTo(0, 0);
        if (latestOrder) {
            startSimulation(latestOrder.id);
        }
    }, [latestOrder, startSimulation]);

    if (!latestOrder) {
        return <div className="p-10 text-center">No order found.</div>;
    }

    return (
        <div className="bg-white min-h-screen flex flex-col items-center md:bg-[#f1f3f6] md:justify-center md:py-10">

            {/* Desktop Card Container */}
            <div className="w-full md:max-w-[480px] md:bg-white md:rounded-lg md:shadow-[0_4px_20px_rgba(0,0,0,0.08)] md:overflow-hidden">

                {/* Header - Mobile Only */}
                <div className="w-full bg-primary-600 text-white p-4 flex items-center justify-between md:hidden">
                    <button onClick={() => navigate('/')} className="material-icons">arrow_back</button>
                    <h1 className="text-lg font-bold">Order Confirmed</h1>
                    <div className="w-6"></div>
                </div>

                {/* Content Wrapper */}
                <div className="flex flex-col items-center w-full md:p-8">

                    {/* Animation/Icon */}
                    <div className="mt-12 mb-8 md:mt-4">
                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                            <span className="material-icons text-green-600 text-[64px]">check_circle</span>
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-gray-800">Payment Successful</h2>
                    <p className="text-gray-500 mt-2 text-center">Your order has been placed successfully.</p>

                    <div className="mt-8 bg-gray-50 w-[90%] md:w-full p-5 rounded-xl border border-dashed border-gray-300">
                        <div className="flex justify-between mb-4">
                            <span className="text-gray-500 text-sm">Order ID</span>
                            <span className="font-bold text-sm">#{latestOrder.id}</span>
                        </div>
                        <div className="flex justify-between mb-4">
                            <span className="text-gray-500 text-sm">Total Amount</span>
                            <span className="font-bold text-sm">₹{latestOrder.totalPrice.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500 text-sm">Estimated Delivery</span>
                            <span className="font-bold text-sm text-green-600">Expected by Mon, 27 Jan</span>
                        </div>
                    </div>

                    <div className="mt-12 w-[90%] md:w-full space-y-4 md:mt-8">
                        <button
                            onClick={() => navigate(`/track-order/${latestOrder.id}`)}
                            className="w-full bg-green-600 text-white py-3.5 rounded-lg font-bold shadow-lg hover:bg-green-700 transition"
                        >
                            Track Order
                        </button>
                        <button
                            onClick={() => {
                                import('../../../utils/invoiceGenerator').then(({ generateInvoice }) => {
                                    generateInvoice(latestOrder, settings);
                                });
                            }}
                            className="w-full bg-purple-600 text-white py-3.5 rounded-lg font-bold shadow-lg hover:bg-purple-700 transition flex items-center justify-center gap-2"
                        >
                            <span className="material-icons">download</span>
                            Download Invoice
                        </button>
                        <button
                            onClick={() => navigate('/my-orders')}
                            className="w-full bg-primary-600 text-white py-3.5 rounded-lg font-bold shadow-lg hover:bg-primary-700 transition"
                        >
                            View My Orders
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full bg-white border border-gray-200 text-gray-700 py-3.5 rounded-lg font-bold hover:bg-gray-50 transition"
                        >
                            Continue Shopping
                        </button>
                    </div>

                    <div className="mt-auto mb-10 text-center text-[10px] text-gray-400 max-w-[80%] uppercase tracking-widest font-bold md:mt-8 md:mb-0">
                        Thank you for shopping with Jaipurio
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderSuccess;
