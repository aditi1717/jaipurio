import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdPrint, MdLocalShipping, MdCheckCircle, MdPendingActions, MdCancel, MdPerson, MdEmail, MdPhone, MdLocationOn, MdPayment, MdSchedule } from 'react-icons/md';
import toast from 'react-hot-toast';
import useOrderStore from '../../store/orderStore';
import InvoiceGenerator from '../../components/orders/InvoiceGenerator';
import API from '../../../../services/api';
import { getFulfillmentMode, getShippingProviderLabel, getTrackingIdentifier, getTrackingIdentifierLabel, getShippingError, getShippingPickupLocation, getShippingSyncedAt, isCourierMode } from '../../../../utils/shippingProvider';
import { getOrderedItemDisplayName, getVariantDetails } from '../../../../utils/orderItemDisplay';
import { getAdminPaymentStatus, getAdminPaymentStatusClass } from '../../utils/paymentStatus';
import useSettingsStore from '../../store/settingsStore';

const formatTrackingDate = (value) => {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const ADMIN_TIMELINE_STATUSES = [
    'Pending',
    'Confirmed',
    'Manifested',
    'Not Picked',
    'Picked Up',
    'Scheduled',
    'Dispatched',
    'In Transit',
    'Out for Delivery',
    'Delivered'
];

const ADMIN_TIMELINE_STATUS_SET = new Set(ADMIN_TIMELINE_STATUSES);
const MANUAL_FULFILLMENT_STATUSES = ['Confirmed', 'Packed', 'Dispatched', 'Out for Delivery', 'Delivered'];

const OrderDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { orders, updateOrderStatus, cancelOrder, getOrderDetails, assignOrderFulfillment, isLoading } = useOrderStore();
    const order = orders.find(o => o.id === id);

    const [updating, setUpdating] = useState(false);
    const [actionNote, setActionNote] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [serialInputs, setSerialInputs] = useState({});
    const [serialTypes, setSerialTypes] = useState({});
    const [showSerialModal, setShowSerialModal] = useState(false);

    // Initialize selected status when modal opens
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [trackingData, setTrackingData] = useState(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackingError, setTrackingError] = useState('');
    const settings = useSettingsStore((state) => state.settings);
    const fetchSettings = useSettingsStore((state) => state.fetchSettings);
    const normalizeFulfillmentStatus = (status = '') => {
        const value = String(status || '').trim();
        if (value === 'Shipped') return 'Dispatched';
        return value;
    };

    React.useEffect(() => {
        if (!order || !order.invoiceNumber) {
            getOrderDetails(id);
        }
        fetchSettings().catch((error) => {
            console.error('Error fetching settings for invoice:', error);
        });
    }, [id, order, order?.invoiceNumber, getOrderDetails, fetchSettings]);

    React.useEffect(() => {
        let cancelled = false;

        const fetchTracking = async () => {
            const fulfillmentMode = getFulfillmentMode(order);
            if (!isCourierMode(fulfillmentMode) || !getTrackingIdentifier(order, fulfillmentMode)) {
                setTrackingData(null);
                setTrackingError('');
                setTrackingLoading(false);
                return;
            }

            setTrackingLoading(true);
            setTrackingError('');

            try {
                const { data } = await API.get(`/orders/${id}/shipping-tracking`);
                if (cancelled) return;
                setTrackingData(data?.tracking || null);
                if (data?.status && order && data.status !== order.status) {
                    getOrderDetails(id);
                }
            } catch (error) {
                if (cancelled) return;
                setTrackingError(error.response?.data?.message || 'Unable to fetch live courier status');
                setTrackingData(null);
            } finally {
                if (!cancelled) {
                    setTrackingLoading(false);
                }
            }
        };

        fetchTracking();

        return () => {
            cancelled = true;
        };
    }, [id, order?.delhivery?.waybill, order?.ekart?.trackingNumber, order?.fulfillment?.mode, order?.status]);

    if (isLoading && !order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-500 font-medium animate-pulse">Loading order details...</p>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-red-50 text-red-400 rounded-full flex items-center justify-center mb-6">
                    <MdCancel size={48} />
                </div>
                <h2 className="text-2xl font-black text-gray-900">Order Not Found</h2>
                <button onClick={() => navigate('/admin/orders')} className="mt-4 text-primary-600 font-bold hover:underline">Back to Orders</button>
            </div>
        );
    }

    const populateSerialFields = () => {
        const initialInputs = {};
        const initialTypes = {};
        order.items.forEach(item => {
            if (item.serialNumber) initialInputs[item._id] = item.serialNumber;
            if (item.serialType) initialTypes[item._id] = item.serialType;
        });
        setSerialInputs(initialInputs);
        setSerialTypes(initialTypes);
    };

    const openUpdateModal = () => {
        setUpdating(true);
        setShowCancelConfirm(false);
        setActionNote('');
        populateSerialFields();
        // Set next logical status or current status
        const normalizedOrderStatus = normalizeFulfillmentStatus(order.status);
        const currentIdx = MANUAL_FULFILLMENT_STATUSES.indexOf(normalizedOrderStatus);
        if (currentIdx !== -1 && currentIdx < MANUAL_FULFILLMENT_STATUSES.length - 1) {
            setSelectedStatus(MANUAL_FULFILLMENT_STATUSES[currentIdx + 1]);
        } else {
            setSelectedStatus(MANUAL_FULFILLMENT_STATUSES.includes(normalizedOrderStatus) ? normalizedOrderStatus : 'Confirmed');
        }
    };

    const openSerialModal = () => {
        populateSerialFields();
        setShowSerialModal(true);
    };

    const openCancelModal = () => {
        setUpdating(true);
        setShowCancelConfirm(true);
        setActionNote('');
        populateSerialFields();
    };

    const handleSerialSave = async () => {
        const serialNumbers = order.items.map(item => ({
            itemId: item._id,
            serial: (serialInputs[item._id] !== undefined ? serialInputs[item._id] : item.serialNumber)?.trim(),
            type: serialTypes[item._id] !== undefined ? serialTypes[item._id] : (item.serialType || 'Serial Number')
        })).filter(s => s.serial);

        if (!serialNumbers.length) {
            toast.error('Enter at least one Serial Number or IMEI before saving.');
            return;
        }

        try {
            // Update with CURRENT status to just save serials
            await updateOrderStatus(id, order.status, '', serialNumbers);
            toast.success('Serial / IMEI saved successfully');
            setShowSerialModal(false);
            setUpdating(false);
            setSerialInputs({});
            setSerialTypes({});
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save Serial / IMEI');
        }
    };

    const handleUpdateClick = () => {
        handleStatusUpdate(selectedStatus);
    };

    const handleAssignFulfillment = async (mode) => {
        try {
            await assignOrderFulfillment(id, mode);
            toast.success(
                mode === 'manual'
                    ? 'Order assigned to manual fulfillment'
                    : `Order assigned to ${getShippingProviderLabel(mode)}`
            );
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign fulfillment mode');
        }
    };

    const handleStatusUpdate = async (newStatus) => {
        // Validation for Packed status
        if (newStatus === 'Packed') {
            // Check if serial is present in input OR already exists in item
            const missingSerials = order.items.some(item => !serialInputs[item._id] && !item.serialNumber);
            if (missingSerials) {
                toast.error('Please enter Serial Number / IMEI for all items before packing.');
                return;
            }

            const serialNumbers = order.items.map(item => ({
                itemId: item._id,
                // Use input value if present, otherwise fallback to existing value
                serial: (serialInputs[item._id] !== undefined ? serialInputs[item._id] : item.serialNumber)?.trim(),
                type: serialTypes[item._id] !== undefined ? serialTypes[item._id] : (item.serialType || 'Serial Number')
            })).filter(s => s.serial); // Only send if we have a serial number

            try {
                await updateOrderStatus(id, newStatus, actionNote, serialNumbers);
                toast.success(`Order marked as ${newStatus}`);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to update order status');
                return;
            }
        } else {
            // Also send serial numbers if they were edited in other statuses
            const hasEdits = Object.keys(serialInputs).length > 0 || Object.keys(serialTypes).length > 0;
            if (hasEdits) {
                const serialNumbers = order.items.map(item => ({
                    itemId: item._id,
                    serial: (serialInputs[item._id] !== undefined ? serialInputs[item._id] : item.serialNumber)?.trim(),
                    type: serialTypes[item._id] !== undefined ? serialTypes[item._id] : (item.serialType || 'Serial Number')
                })).filter(s => s.serial); // Only send valid ones

                try {
                    await updateOrderStatus(id, newStatus, actionNote, serialNumbers);
                    toast.success(`Order marked as ${newStatus}`);
                } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed to update order status');
                    return;
                }
            } else {
                try {
                    await updateOrderStatus(id, newStatus, actionNote);
                    toast.success(`Order marked as ${newStatus}`);
                } catch (error) {
                    toast.error(error.response?.data?.message || 'Failed to update order status');
                    return;
                }
            }
        }

        setActionNote('');
        setSerialInputs({});
        setSerialTypes({});
        setUpdating(false);
    };

    const normalizedCurrentStatus = normalizeFulfillmentStatus(order.status);
    const fulfillmentMode = getFulfillmentMode(order);
    const isManualMode = fulfillmentMode === 'manual';
    const hasCourierFulfillment = isCourierMode(fulfillmentMode);
    const isFulfillmentAssigned = hasCourierFulfillment || isManualMode;
    const liveApiStatus = String(trackingData?.currentStatus || '').trim();
    const effectiveAdminStatus = (hasCourierFulfillment ? liveApiStatus : '') || normalizedCurrentStatus || order.status;
    const displayOrderStatus = effectiveAdminStatus;
    const rawTrackingScans = Array.isArray(trackingData?.scans) ? trackingData.scans : [];
    const currentRawApiStatus = String(trackingData?.currentStatus || '').trim();
    const currentRawApiLastUpdatedAt = trackingData?.lastUpdatedAt || null;
    const scanTimeByStatus = rawTrackingScans.reduce((acc, scan) => {
        const key = String(scan?.status || '').trim();
        if (!key || !scan?.time || acc[key]) return acc;
        acc[key] = scan.time;
        return acc;
    }, {});
    const scanLocationByStatus = rawTrackingScans.reduce((acc, scan) => {
        const key = String(scan?.status || '').trim();
        if (!key || acc[key]) return acc;
        acc[key] = scan.location || '';
        return acc;
    }, {});
    const adminTimelineEntries = ADMIN_TIMELINE_STATUSES.map((status) => {
        let time = null;
        let type = 'api';

        if (status === 'Pending') {
            time = order.createdAt || order.date || null;
            type = 'system';
        } else if (status === 'Confirmed') {
            time = hasCourierFulfillment ? (getShippingSyncedAt(order, fulfillmentMode) || null) : (normalizedCurrentStatus !== 'Pending' ? (order.updatedAt || null) : null);
            type = 'system';
        } else if (status === 'Delivered') {
            time = (hasCourierFulfillment ? scanTimeByStatus[status] : null) || order.deliveredAt || null;
        } else {
            time = hasCourierFulfillment ? (scanTimeByStatus[status] || null) : (normalizedCurrentStatus === status ? (order.updatedAt || null) : null);
        }

        if (hasCourierFulfillment && !time && status === currentRawApiStatus) {
            time = currentRawApiLastUpdatedAt;
        }

        return {
            key: status,
            status,
            time,
            location: scanLocationByStatus[status] || '',
            type
        };
    });

    const timelineApiStatus = ADMIN_TIMELINE_STATUS_SET.has(currentRawApiStatus)
        ? currentRawApiStatus
        : '';
    const timelineOrderStatus = ADMIN_TIMELINE_STATUS_SET.has(normalizedCurrentStatus)
        ? normalizedCurrentStatus
        : '';
    const currentTimelineStatus = (hasCourierFulfillment ? timelineApiStatus : '')
        || (hasCourierFulfillment && getShippingSyncedAt(order, fulfillmentMode) ? 'Confirmed' : '')
        || timelineOrderStatus;
    const currentTimelineIndex = adminTimelineEntries.findIndex((entry) => entry.status === currentTimelineStatus);
    const paymentStatusLabel = getAdminPaymentStatus(order);
    const paymentStatusClass = getAdminPaymentStatusClass(paymentStatusLabel);
    const summaryItemsPrice = Number(order.itemsPrice ?? Math.max(0, (order.total || 0) - Number(order.shippingPrice || 0) - Number(order.taxPrice || 0)));
    const summaryShippingPrice = Number(order.shippingPrice || 0);
    const summaryTotal = Number(order.total || 0);
    const isCodAdvancedPaid = Boolean(order.isCodAdvancedPaid) && Number(order.codAdvancedAmount) > 0;
    const codAdvancedAmount = Number(order.codAdvancedAmount || 0);
    const remainingCodBalance = Number(order.remainingCodBalance || 0);
    const customerProfileId = order.user?._id || order.user?.id;

    return (
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6 bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2 md:gap-6">
                    <button
                        onClick={() => navigate('/admin/orders')}
                        className="p-2 md:p-4 bg-gray-50 hover:bg-white border border-transparent hover:border-gray-100 text-gray-500 hover:text-gray-900 rounded-xl md:rounded-2xl transition-all shadow-sm group"
                    >
                        <MdArrowBack size={20} className="md:w-6 md:h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 md:gap-3 mb-1">
                            <h1 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight">{order.displayId || order.id}</h1>
                            <span className={`px-2 py-1 md:px-4 md:py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-sm ${
                                ['Delivered', 'Collected'].includes(displayOrderStatus)
                                    ? 'bg-green-100 text-green-600'
                                    : ['Cancelled', 'RTO', 'DTO'].includes(displayOrderStatus)
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-primary-100 text-primary-600 animate-pulse'
                            }`}>
                                {displayOrderStatus}
                            </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-400 font-medium">Placed on {new Date(order.date).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <InvoiceGenerator
                        order={order}
                        items={order.items}
                        settings={settings}
                        trackingData={trackingData}
                        customTrigger={
                            <button className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-white border border-gray-100 text-gray-600 font-black text-[10px] md:text-xs rounded-xl md:rounded-2xl hover:bg-gray-50 transition-all shadow-sm uppercase tracking-widest">
                                <MdPrint size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden md:inline">Print Invoice</span><span className="md:hidden">Invoice</span>
                            </button>
                        }
                    />

                    {/* Separate Serial/IMEI Button */}
                    {effectiveAdminStatus !== 'Cancelled' && (
                        <button
                            onClick={openSerialModal}
                            className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 font-black text-[10px] md:text-xs rounded-xl md:rounded-2xl hover:bg-indigo-100 transition-all shadow-sm uppercase tracking-widest"
                        >
                            <MdPendingActions size={16} className="md:w-[18px] md:h-[18px]" /> <span className="hidden md:inline">Manage Serials</span><span className="md:hidden">Serials</span>
                        </button>
                    )}

                    {effectiveAdminStatus !== 'Cancelled' ? (
                        <div className="min-w-[170px]">
                            <select
                                value={isFulfillmentAssigned ? fulfillmentMode : ''}
                                onChange={(e) => {
                                    if (!e.target.value) return;
                                    handleAssignFulfillment(e.target.value);
                                }}
                                disabled={effectiveAdminStatus === 'Delivered'}
                                className="w-full bg-white border border-gray-200 focus:border-primary-500 rounded-xl md:rounded-2xl px-3 py-2.5 md:px-4 md:py-3 text-[10px] md:text-xs font-black outline-none transition-all text-gray-900 shadow-sm uppercase tracking-widest"
                            >
                                <option value="">Choose Delivery Type</option>
                                <option value="manual">Manual</option>
                                <option value="delhivery">Delhivery</option>
                                <option value="ekart">Ekart</option>
                            </select>
                        </div>
                    ) : null}

                    {isManualMode && effectiveAdminStatus !== 'Delivered' && effectiveAdminStatus !== 'Cancelled' && (
                        <button
                            onClick={openUpdateModal}
                            className="flex items-center gap-1 md:gap-2 px-3 py-2 md:px-6 md:py-3 bg-primary-600 text-white font-black text-[10px] md:text-xs rounded-xl md:rounded-2xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 uppercase tracking-widest"
                        >
                            <span className="hidden md:inline">Update Status</span><span className="md:hidden">Update</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-8">
                {/* Main Content */}
                <div className="lg:col-span-8 space-y-4 md:space-y-8">
                    {/* Order Items */}
                    <div className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-gray-50 bg-gray-50/30">
                            <h2 className="text-xs md:text-sm font-black text-gray-800 uppercase tracking-widest">Order Items ({order.items.length})</h2>
                        </div>
                        <div className="divide-y divide-gray-200">
                            {order.items.map((item, idx) => {
                                const orderedItemName = getOrderedItemDisplayName(item);
                                const variantDetails = getVariantDetails(item.variant);

                                return (
                                <div key={idx} className="p-4 md:p-6 flex items-center gap-3 md:gap-6 hover:bg-gray-50/50 transition-colors">
                                    <div className="w-14 h-14 md:w-20 md:h-20 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100 p-2 overflow-hidden flex-shrink-0">
                                        <img src={item.image} className="w-full h-full object-contain" alt={orderedItemName} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-black text-gray-800 group-hover:text-primary-600 transition-colors break-words" title={orderedItemName}>{orderedItemName}</h3>
                                        {variantDetails.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {variantDetails.map((detail) => (
                                                    <span key={detail} className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-primary-700 border border-primary-100">
                                                        {detail}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded">ID: {item.id}</span>
                                            <span className="text-[10px] font-black text-gray-400 uppercase">Quantity: {item.quantity}</span>
                                        </div>
                                        {item.serialNumber && (
                                            <div className="mt-2">
                                                <span className="text-sm bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg font-bold font-mono border border-primary-200 shadow-sm flex items-center gap-2 w-max select-all">
                                                    <span className="text-primary-400 select-none">{item.serialType === 'IMEI' ? 'IMEI:' : 'SN:'}</span> {item.serialNumber}
                                                </span>
                                            </div>
                                        )}
                                        <div className="mt-3">
                                            <InvoiceGenerator order={order} item={item} settings={settings} trackingData={trackingData} />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-gray-900">₹{item.price.toLocaleString()}</div>
                                        <div className="text-[10px] font-bold text-gray-400 uppercase mt-1">₹{(item.price * item.quantity).toLocaleString()} Subtotal</div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                        <div className="p-4 md:p-8 bg-gray-50/30 border-t border-gray-50 flex flex-col items-end gap-2 md:gap-3 text-right">
                            <div className="flex justify-between w-full max-w-[160px] md:max-w-[200px] text-[10px] md:text-xs font-bold text-gray-400 uppercase">
                                <span>Subtotal</span>
                                <span>₹{summaryItemsPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between w-full max-w-[160px] md:max-w-[200px] text-[10px] md:text-xs font-bold text-gray-400 uppercase">
                                <span>Shipping</span>
                                <span className={summaryShippingPrice === 0 ? 'text-green-500' : 'text-gray-700'}>
                                    {summaryShippingPrice === 0 ? 'FREE' : `₹${summaryShippingPrice.toLocaleString()}`}
                                </span>
                            </div>
                            {isCodAdvancedPaid && (
                                <div className="flex justify-between w-full max-w-[160px] md:max-w-[200px] text-[10px] md:text-xs font-bold text-green-600 uppercase">
                                    <span>COD Advance Paid</span>
                                    <span>-₹{codAdvancedAmount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between w-full max-w-[160px] md:max-w-[200px] text-lg md:text-xl font-black text-gray-900 mt-1 md:mt-2">
                                <span>{isCodAdvancedPaid ? 'REMAINING COD' : 'TOTAL'}</span>
                                <span>₹{(isCodAdvancedPaid ? remainingCodBalance : summaryTotal).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white p-4 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
                        <h2 className="text-xs md:text-sm font-black text-gray-800 uppercase tracking-widest mb-6 md:mb-8 flex items-center gap-2 md:gap-3">
                            <MdSchedule className="text-primary-500" size={18} /> Order Timeline
                        </h2>
                        <div className="space-y-4 md:space-y-5">
                            {adminTimelineEntries.map((entry, idx) => {
                                const isLast = idx === adminTimelineEntries.length - 1;
                                const isCurrent = entry.status === currentTimelineStatus;
                                const isCompleted = currentTimelineIndex >= 0
                                    ? idx < currentTimelineIndex
                                    : Boolean(entry.time);
                                const displayTime = entry.time ? new Date(entry.time) : null;
                                return (
                                <div key={entry.key} className="flex items-start gap-3 md:gap-4">
                                    <div className="flex flex-col items-center pt-1">
                                        <div className={`w-3 h-3 rounded-full ${isCurrent
                                            ? 'bg-primary-600 ring-4 ring-primary-100'
                                            : isCompleted || displayTime
                                                ? 'bg-green-500'
                                                : 'bg-gray-300'
                                            }`}></div>
                                        {!isLast && (
                                            <div className={`w-[2px] h-10 md:h-12 mt-1 ${currentTimelineIndex >= 0 && idx < currentTimelineIndex ? 'bg-green-200' : 'bg-gray-200'}`}></div>
                                        )}
                                    </div>
                                    <div className="flex-1 border-b border-gray-100 pb-3 md:pb-4">
                                        <h4 className={`text-sm md:text-base font-black uppercase tracking-wide ${displayTime ? 'text-gray-900' : 'text-gray-400'}`}>
                                            {entry.status}
                                        </h4>
                                        {displayTime ? (
                                            <p className="text-[11px] md:text-xs text-gray-500 font-bold mt-1">
                                                {displayTime.toLocaleString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        ) : (
                                            <p className="text-[11px] md:text-xs text-gray-400 font-bold mt-1">Pending update</p>
                                        )}
                                        {entry.location ? (
                                            <p className="text-[11px] md:text-xs text-gray-500 font-semibold mt-1">{entry.location}</p>
                                        ) : null}
                                        {isCurrent && entry.type !== 'api' ? (
                                            <p className="text-[10px] text-primary-600 font-black uppercase tracking-wider mt-1">
                                                Current status
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Sidebar Details */}
                <div className="lg:col-span-4 space-y-4 md:space-y-8">
                    {/* User Info */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm space-y-4 md:space-y-6">
                        <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-3 md:pb-4">Customer Profile</h2>
                        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-2xl">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary-500 shadow-sm font-black text-xl">
                                {order.user?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0">
                                {customerProfileId ? (
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/admin/users/${customerProfileId}`)}
                                        className="truncate text-left text-sm font-black text-gray-900 transition hover:text-primary-600"
                                    >
                                        {order.user?.name || order.shippingAddress?.name || 'Unknown User'}
                                    </button>
                                ) : (
                                    <h4 className="text-sm font-black text-gray-900 truncate">{order.user?.name || order.shippingAddress?.name || 'Unknown User'}</h4>
                                )}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-gray-600">
                                <MdEmail className="text-gray-300" size={18} />
                                <span className="text-xs font-medium truncate">{order.user?.email || order.shippingAddress?.email || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-gray-600">
                                <MdPhone className="text-gray-300" size={18} />
                                <span className="text-xs font-medium">{order.shippingAddress?.phone || order.user?.phone || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm space-y-4 md:space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest">Delivery Address</h2>
                            <span className="px-2 py-0.5 bg-gray-100 text-[8px] font-black uppercase rounded text-gray-500">{order.address?.type || 'Home'}</span>
                        </div>
                        <div className="flex gap-4">
                            <MdLocationOn className="text-primary-500 flex-shrink-0 mt-1" size={20} />
                            <div className="text-xs text-gray-600 leading-relaxed font-medium">
                                <p className="font-black text-gray-900 mb-1">{order.shippingAddress?.name || order.address?.name || order.user?.name || 'N/A'}</p>
                                <p>{order.address?.line || order.shippingAddress?.street || 'N/A'}</p>
                                <p>{order.address?.city || order.shippingAddress?.city || 'N/A'}, {order.address?.state || order.shippingAddress?.state || 'N/A'}</p>
                                <p className="font-black mt-1 text-gray-400">{order.address?.pincode || order.shippingAddress?.postalCode || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm space-y-4 md:space-y-6">
                        <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Payment Metadata</h2>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-bold uppercase tracking-widest text-[9px]">Method</span>
                                <span className="font-black text-gray-900">{order.payment?.method || order.paymentMethod || 'COD'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-bold uppercase tracking-widest text-[9px]">Status</span>
                                <span className={`font-black uppercase tracking-tighter px-2 py-0.5 rounded ${paymentStatusClass}`}>
                                    {paymentStatusLabel}
                                </span>
                            </div>
                            {order.payment?.transactionId && (
                                <div className="pt-4 border-t border-gray-50">
                                    <p className="text-[9px] font-black text-gray-600 uppercase mb-1">Transaction ID</p>
                                    <p className="text-[11px] font-bold text-gray-800 font-mono break-all bg-gray-50 p-2 rounded-lg">{order.payment.transactionId}</p>
                                </div>
                            )}

                            {order.payment?.cardNetwork && (
                                <div className="pt-4 border-t border-gray-50 grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[9px] font-black text-gray-600 uppercase mb-1">Card Network</p>
                                        <p className="text-[11px] font-black text-gray-900 uppercase tracking-wider">{order.payment.cardNetwork}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-gray-600 uppercase mb-1">Card Type</p>
                                        <p className="text-[11px] font-black text-gray-900 uppercase tracking-wider">{order.payment.cardType || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-[9px] font-black text-gray-600 uppercase mb-1">Card Number</p>
                                        <p className="text-[11px] font-bold text-gray-800 font-mono">**** **** **** {order.payment.cardLast4}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm space-y-4 md:space-y-6">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-xs font-black text-gray-700 uppercase tracking-widest">Fulfillment</h2>
                            <div className="flex items-center gap-2">
                                {hasCourierFulfillment && effectiveAdminStatus !== 'Delivered' && effectiveAdminStatus !== 'Cancelled' ? (
                                    <button
                                        type="button"
                                        onClick={openCancelModal}
                                        className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-600 transition-all hover:bg-red-100"
                                    >
                                        Cancel Order
                                    </button>
                                ) : null}
                                {hasCourierFulfillment && getTrackingIdentifier(order, fulfillmentMode) ? (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                setTrackingLoading(true);
                                                setTrackingError('');
                                                const { data } = await API.get(`/orders/${id}/shipping-tracking`);
                                                setTrackingData(data?.tracking || null);
                                            } catch (error) {
                                                setTrackingError(error.response?.data?.message || 'Unable to refresh live courier status');
                                                setTrackingData(null);
                                            } finally {
                                                setTrackingLoading(false);
                                            }
                                        }}
                                        className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary-600 transition-all hover:bg-primary-100"
                                    >
                                        {trackingLoading ? 'Refreshing...' : 'Refresh Live Status'}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-bold uppercase tracking-widest text-[9px]">Mode</span>
                                <span className={`font-black uppercase tracking-wider ${hasCourierFulfillment ? 'text-primary-700' : isManualMode ? 'text-amber-700' : 'text-gray-500'}`}>
                                    {getShippingProviderLabel(fulfillmentMode)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-bold uppercase tracking-widest text-[9px]">{getTrackingIdentifierLabel(fulfillmentMode)}</span>
                                <span className="font-black text-gray-900">{hasCourierFulfillment ? (getTrackingIdentifier(order, fulfillmentMode) || 'Not created yet') : 'Not applicable'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-bold uppercase tracking-widest text-[9px]">Pickup Location</span>
                                <span className="font-black text-gray-900">{hasCourierFulfillment ? (getShippingPickupLocation(order, fulfillmentMode) || 'N/A') : 'Not applicable'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-600 font-bold uppercase tracking-widest text-[9px]">Synced At</span>
                                <span className="font-black text-gray-900">
                                    {hasCourierFulfillment
                                        ? (getShippingSyncedAt(order, fulfillmentMode) ? new Date(getShippingSyncedAt(order, fulfillmentMode)).toLocaleString() : 'Pending')
                                        : 'Manual updates'}
                                </span>
                            </div>
                            {isManualMode ? (
                                <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-xs font-semibold text-amber-800">
                                    This order is on manual fulfillment. Customer tracking will use admin-updated statuses instead of live courier events.
                                </div>
                            ) : null}
                            {trackingLoading ? (
                                <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4 text-xs font-semibold text-primary-600">
                                    Fetching live {getShippingProviderLabel(fulfillmentMode)} tracking...
                                </div>
                            ) : null}
                            {trackingData ? (
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 space-y-3">
                                    <div className="flex justify-between items-center gap-4 text-xs">
                                        <span className="text-emerald-700 font-bold uppercase tracking-widest text-[9px]">Raw API Status</span>
                                        <span className="font-black text-emerald-900 uppercase text-right break-words">
                                            {trackingData.currentStatus || 'Status unavailable'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 text-xs">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 mb-1">Current Location</p>
                                            <p className="font-bold text-gray-900 break-words">{trackingData.currentLocation || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 mb-1">Last Updated</p>
                                            <p className="font-bold text-gray-900 break-words">{formatTrackingDate(trackingData.lastUpdatedAt)}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                            {trackingError ? (
                                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
                                    {trackingError}
                                </div>
                            ) : null}
                            {getShippingError(order, fulfillmentMode) ? (
                                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-semibold text-red-600">
                                    {getShippingError(order, fulfillmentMode)}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Update Modal/Pop-up */}
            {updating && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
                        {!showCancelConfirm ? (
                            <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-black text-gray-900">Update fulfillment status</h3>
                                    <button onClick={() => setUpdating(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><MdCancel size={24} /></button>
                                </div>

                                <div className="space-y-3">
                                    {!isFulfillmentAssigned ? (
                                        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
                                            <p className="text-xs font-bold uppercase tracking-widest text-primary-700">Assign Fulfillment First</p>
                                            <p className="mt-2 text-sm font-semibold text-primary-900">
                                                Pick Delhivery or Ekart for API-based tracking, or Manual if your team will update each status here.
                                            </p>
                                        </div>
                                    ) : hasCourierFulfillment ? (
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Live Courier Controlled</p>
                                            <p className="mt-2 text-sm font-semibold text-emerald-900">
                                                Fulfillment status is now driven by {getShippingProviderLabel(fulfillmentMode)} live tracking. You can update Serial/IMEI details here.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                                            <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Manual Fulfillment</p>
                                            <p className="mt-2 text-sm font-semibold text-amber-900">
                                                This order will follow admin-updated statuses. Choose the next manual step below.
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-2">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Delivery Type</p>
                                            <select
                                                value={isFulfillmentAssigned ? fulfillmentMode : ''}
                                                onChange={(e) => {
                                                    if (!e.target.value) return;
                                                    handleAssignFulfillment(e.target.value);
                                                }}
                                                disabled={effectiveAdminStatus === 'Delivered' || effectiveAdminStatus === 'Cancelled'}
                                                className="w-full bg-white border border-gray-200 focus:border-primary-500 rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all text-gray-900 shadow-sm"
                                            >
                                                <option value="">Choose delivery type</option>
                                                <option value="manual">Manual</option>
                                                <option value="delhivery">Delhivery</option>
                                                <option value="ekart">Ekart</option>
                                            </select>
                                        </div>

                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <MdLocalShipping size={14} />
                                            {!isFulfillmentAssigned ? 'Add Serial/IMEI Before Assignment' : 'Edit Serial/IMEI Numbers'}
                                        </p>
                                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100 max-h-60 overflow-y-auto">
                                            {order.items.map(item => (
                                                <div key={item._id} className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-700 truncate block">{item.name}</label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            className="bg-white border border-gray-200 focus:border-primary-500 rounded-xl px-3 py-3 text-xs font-bold outline-none transition-all text-gray-700 shadow-sm w-1/3 appearance-none"
                                                            value={serialTypes[item._id] || (item.serialType || 'Serial Number')}
                                                            onChange={(e) => setSerialTypes(prev => ({ ...prev, [item._id]: e.target.value }))}
                                                        >
                                                            <option>Serial Number</option>
                                                            <option>IMEI</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            list={`serials-${item._id}`}
                                                            placeholder="Enter Number..."
                                                            className="flex-1 bg-white border border-gray-200 focus:border-primary-500 rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-gray-400 font-mono text-gray-900 shadow-sm"
                                                            value={serialInputs[item._id] !== undefined ? serialInputs[item._id] : (item.serialNumber || '')}
                                                            onChange={(e) => setSerialInputs(prev => ({ ...prev, [item._id]: e.target.value }))}
                                                        />
                                                    </div>
                                                    <datalist id={`serials-${item._id}`}>
                                                        <option value="SN-EXAMPLE-01" />
                                                        <option value="SN-EXAMPLE-02" />
                                                        <option value="IMEI-TEST-123456789012345" />
                                                    </datalist>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {isManualMode ? (
                                        <>
                                            {effectiveAdminStatus !== 'Delivered' && effectiveAdminStatus !== 'Cancelled' ? (
                                                <>
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Manual Status</p>
                                                        <select
                                                            value={selectedStatus}
                                                            onChange={(e) => setSelectedStatus(e.target.value)}
                                                            className="w-full bg-white border border-gray-200 focus:border-primary-500 rounded-2xl px-4 py-3 text-sm font-bold outline-none transition-all text-gray-900 shadow-sm"
                                                        >
                                                            {MANUAL_FULFILLMENT_STATUSES.map((status) => (
                                                                <option key={status} value={status}>{status}</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <button
                                                        onClick={handleUpdateClick}
                                                        className="w-full mt-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-primary-200 hover:shadow-xl hover:scale-[1.02] transition-all"
                                                    >
                                                        Update Manual Status
                                                    </button>
                                                </>
                                            ) : null}

                                            {effectiveAdminStatus !== 'Delivered' && effectiveAdminStatus !== 'Cancelled' ? (
                                                <button
                                                    onClick={() => setShowCancelConfirm(true)}
                                                    className="w-full mt-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                                                >
                                                    Cancel Order
                                                </button>
                                            ) : null}
                                        </>
                                    ) : !isFulfillmentAssigned ? (
                                        <>
                                            {effectiveAdminStatus !== 'Delivered' && effectiveAdminStatus !== 'Cancelled' ? (
                                                <button
                                                    onClick={() => setShowCancelConfirm(true)}
                                                    className="w-full mt-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                                                >
                                                    Cancel Order
                                                </button>
                                            ) : null}
                                        </>
                                    ) : (
                                        <>
                                            {effectiveAdminStatus !== 'Delivered' && effectiveAdminStatus !== 'Cancelled' ? (
                                                <button
                                                    onClick={() => setShowCancelConfirm(true)}
                                                    className="w-full mt-2 px-4 py-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                                                >
                                                    Cancel Order
                                                </button>
                                            ) : null}

                                            <button
                                                onClick={handleSerialSave}
                                                className="w-full mt-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-primary-200 hover:shadow-xl hover:scale-[1.02] transition-all"
                                            >
                                                Save Serial / IMEI
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-black text-red-600">Cancel Order?</h3>
                                    <button onClick={() => setShowCancelConfirm(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><MdCancel size={24} /></button>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-sm text-gray-600">Are you sure you want to cancel this order? This action cannot be undone.</p>

                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cancellation Reason (Required)</p>
                                        <textarea
                                            placeholder="Please provide a reason for cancellation..."
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-red-500 rounded-2xl p-4 outline-none text-sm transition-all h-32 font-medium text-gray-900 placeholder:text-gray-400"
                                            value={actionNote}
                                            onChange={(e) => setActionNote(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setShowCancelConfirm(false)}
                                            className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-all font-black uppercase tracking-tight"
                                        >
                                            Back
                                        </button>
                                        <button
                                            disabled={!actionNote.trim()}
                                            onClick={() => {
                                                cancelOrder(id, actionNote);
                                                setUpdating(false);
                                            }}
                                            className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed font-black uppercase tracking-tight"
                                        >
                                            Confirm Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Serial Only Modal */}
            {
                showSerialModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-white w-full max-w-md rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8">
                            <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-black text-gray-900">Manage Serial/IMEI Numbers</h3>
                                    <button onClick={() => setShowSerialModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><MdCancel size={24} /></button>
                                </div>

                                <div className="space-y-3">
                                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                            <MdLocalShipping size={14} />
                                            Update Product Identification
                                        </p>
                                        <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100 max-h-[60vh] overflow-y-auto">
                                            {order.items.map(item => (
                                                <div key={item._id} className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-700 truncate block">{item.name}</label>
                                                    <div className="flex gap-2">
                                                        <select
                                                            className="bg-white border border-gray-200 focus:border-primary-500 rounded-xl px-3 py-3 text-xs font-bold outline-none transition-all text-gray-700 shadow-sm w-1/3 appearance-none"
                                                            value={serialTypes[item._id] || (item.serialType || 'Serial Number')}
                                                            onChange={(e) => setSerialTypes(prev => ({ ...prev, [item._id]: e.target.value }))}
                                                        >
                                                            <option>Serial Number</option>
                                                            <option>IMEI</option>
                                                        </select>
                                                        <input
                                                            type="text"
                                                            placeholder={`Enter Number...`}
                                                            className="flex-1 bg-white border border-gray-200 focus:border-primary-500 rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-gray-400 font-mono text-gray-900 shadow-sm"
                                                            value={serialInputs[item._id] !== undefined ? serialInputs[item._id] : (item.serialNumber || '')}
                                                            onChange={(e) => setSerialInputs(prev => ({ ...prev, [item._id]: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleSerialSave}
                                        className="w-full mt-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-primary-600 text-white text-sm font-black uppercase tracking-widest shadow-lg shadow-primary-200 hover:shadow-xl hover:scale-[1.02] transition-all"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default OrderDetail;
