import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdLocalShipping, MdSearch, MdFilterList, MdDownload, MdCheckBox, MdCheckBoxOutlineBlank } from 'react-icons/md';
import useOrderStore from '../../store/orderStore';
import InvoiceGenerator, { BulkInvoiceGenerator } from '../../components/orders/InvoiceGenerator';
import { matchesNormalizedSearch } from '../../utils/search';
import useSettingsStore from '../../store/settingsStore';

const DeliverySlip = () => {
    const navigate = useNavigate();
    const { orders, fetchOrders } = useOrderStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedOrders, setSelectedOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const settings = useSettingsStore((state) => state.settings);
    const fetchSettings = useSettingsStore((state) => state.fetchSettings);

    async function loadOrders() {
        setLoading(true);
        await fetchOrders({
            pageNumber: 1,
            limit: 100,
            syncPayments: false,
            syncFulfillment: false,
            includePaymentAudit: false
        });
        setLoading(false);
    }

    useEffect(() => {
        loadOrders();
        fetchSettings().catch((error) => {
            console.error('Error fetching settings for invoice:', error);
        });
    }, [fetchSettings]);

    // Apply search and filter
    const filteredOrders = orders.filter(order => {
        const matchesSearch =
            matchesNormalizedSearch(order.displayId || order.id, searchTerm) ||
            matchesNormalizedSearch(order.user?.name, searchTerm) ||
            matchesNormalizedSearch(order.user?.phone, searchTerm);

        const matchesStatus = statusFilter === 'All' || order.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const handleSelectOrder = (orderId) => {
        setSelectedOrders(prev =>
            prev.includes(orderId)
                ? prev.filter(id => id !== orderId)
                : [...prev, orderId]
        );
    };

    const handleSelectAll = () => {
        if (selectedOrders.length === filteredOrders.length) {
            setSelectedOrders([]);
        } else {
            setSelectedOrders(filteredOrders.map(order => order.id));
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-semibold">Loading orders...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center">
                            <MdLocalShipping className="text-primary-600" size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900">Delivery & Invoices</h1>
                            <p className="text-sm text-gray-500 mt-1">Generate delivery slips and invoices for all orders</p>
                        </div>
                    </div>
                    {selectedOrders.length > 0 && (
                        <BulkInvoiceGenerator
                            orders={orders.filter(order => selectedOrders.includes(order.id))}
                            settings={settings}
                            customTrigger={
                                <button
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-bold text-sm rounded-2xl hover:shadow-lg transition-all uppercase tracking-wider"
                                >
                                    <MdDownload size={20} />
                                    Generate {selectedOrders.length} Invoice{selectedOrders.length > 1 ? 's' : ''}
                                </button>
                            }
                        />
                    )}
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by Order ID, Customer Name, or Phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none transition-all text-sm text-gray-900 placeholder:text-gray-900 font-bold"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                        <MdFilterList className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-primary-500 rounded-2xl outline-none transition-all text-sm font-black text-gray-900 appearance-none cursor-pointer"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Packed">Packed</option>
                            <option value="Dispatched">Dispatched</option>
                            <option value="Out for Delivery">Out for Delivery</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="mt-4 flex items-center justify-between text-sm">
                    <p className="text-gray-500">
                        Showing <span className="font-bold text-gray-900">{filteredOrders.length}</span> of <span className="font-bold text-gray-900">{orders.length}</span> total orders
                    </p>
                    {filteredOrders.length > 0 && (
                        <button
                            onClick={handleSelectAll}
                            className="text-primary-600 font-bold hover:underline flex items-center gap-1"
                        >
                            {selectedOrders.length === filteredOrders.length ? (
                                <>
                                    <MdCheckBox size={18} />
                                    Deselect All
                                </>
                            ) : (
                                <>
                                    <MdCheckBoxOutlineBlank size={18} />
                                    Select All
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm text-center">
                    <MdLocalShipping className="text-gray-300 mx-auto mb-4" size={64} />
                    <h3 className="text-xl font-black text-gray-900 mb-2">No Orders Found</h3>
                    <p className="text-gray-500">
                        {searchTerm || statusFilter !== 'All'
                            ? 'Try adjusting your search or filter criteria'
                            : 'No orders found in the system'
                        }
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-900 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedOrders.length === filteredOrders.length}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left text-[10px] md:text-xs font-black text-white uppercase tracking-widest whitespace-nowrap">Order ID</th>
                                    <th className="px-6 py-4 text-left text-[10px] md:text-xs font-black text-white uppercase tracking-widest whitespace-nowrap">Customer</th>
                                    <th className="px-6 py-4 text-left text-[10px] md:text-xs font-black text-white uppercase tracking-widest whitespace-nowrap">Phone</th>
                                    <th className="px-6 py-4 text-left text-[10px] md:text-xs font-black text-white uppercase tracking-widest whitespace-nowrap">Status</th>
                                    <th className="px-6 py-4 text-left text-[10px] md:text-xs font-black text-white uppercase tracking-widest whitespace-nowrap">Items</th>
                                    <th className="px-6 py-4 text-left text-[10px] md:text-xs font-black text-white uppercase tracking-widest whitespace-nowrap">COD Amount</th>
                                    <th className="px-6 py-4 text-center text-[10px] md:text-xs font-black text-white uppercase tracking-widest whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedOrders.includes(order.id)}
                                                onChange={() => handleSelectOrder(order.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => navigate(`/admin/orders/${order.id}`)}
                                                className="text-sm font-black text-primary-600 hover:underline"
                                            >
                                                {order.displayId || order.id}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-bold text-gray-900">{order.user?.name || 'N/A'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600">{order.user?.phone || 'N/A'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-tight ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                                order.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                                    order.status === 'Pending' ? 'bg-gray-100 text-gray-700' :
                                                        order.status === 'Confirmed' ? 'bg-primary-100 text-primary-700' :
                                                            order.status === 'Packed' ? 'bg-indigo-100 text-indigo-700' :
                                                                order.status === 'Dispatched' ? 'bg-purple-100 text-purple-700' :
                                                                    'bg-orange-100 text-orange-700'
                                                }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-gray-600">{order.items?.length || 0} item(s)</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {order.payment?.method === 'COD' || !order.isPaid ? (
                                                <p className="text-sm font-bold text-red-600">₹{order.total?.toLocaleString('en-IN') || '0'}</p>
                                            ) : (
                                                <p className="text-sm text-gray-400">Paid</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <InvoiceGenerator
                                                order={order}
                                                items={order.items}
                                                settings={settings}
                                                customTrigger={
                                                    <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 transition-all mx-auto shadow-sm">
                                                        <MdDownload size={16} />
                                                        Invoice
                                                    </button>
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Info Box */}
            <div className="bg-primary-50 border-2 border-primary-200 p-6 rounded-3xl">
                <div className="flex gap-4">
                    <MdLocalShipping className="text-primary-600 flex-shrink-0 mt-1" size={24} />
                    <div>
                        <h3 className="text-sm font-black text-primary-900 uppercase tracking-wider mb-2">Quick Tips</h3>
                        <ul className="text-sm text-primary-800 space-y-1">
                            <li>• View and manage <strong>All Orders</strong> irrespective of their current status</li>
                            <li>• Select multiple orders to generate a bulk PDF with all invoices/slips</li>
                            <li>• Each document includes customer details, items, and payment info</li>
                            <li>• Use the search bar for quick access by ID, Name or Phone</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeliverySlip;
