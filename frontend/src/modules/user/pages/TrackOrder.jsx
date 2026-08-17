import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import API from '../../../services/api';
import { confirmToast } from '../../../utils/toastUtils.jsx';
import { getFulfillmentMode, getShippingProviderLabel, getTrackingIdentifier, getTrackingIdentifierLabel } from '../../../utils/shippingProvider';

const normalizeOrderStatus = (status = '') => {
    const value = String(status || '').trim();
    if (value === 'Shipped') return 'Dispatched';
    return value;
};

const formatTrackingDate = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getOrderSteps = () => ([
    { status: 'Pending', title: 'Order Placed', desc: 'Your order has been received successfully' },
    { status: 'Confirmed', title: 'Confirmed', desc: 'Your order has been confirmed by the admin team' },
    { status: 'Packed', title: 'Packed', desc: 'Your order has been packed and is ready for dispatch' },
    { status: 'Processing', title: 'Processing', desc: 'Courier partner is processing the shipment after confirmation' },
    { status: 'Not Picked', title: 'Not Picked', desc: 'Shipment is created but pickup is still pending' },
    { status: 'Picked Up', title: 'Picked Up', desc: 'Shipment has been picked up by the courier partner' },
    { status: 'Dispatched', title: 'Dispatched', desc: 'Shipment has been handed over to the courier partner' },
    { status: 'In Transit', title: 'In Transit', desc: 'Shipment is moving through the courier network' },
    { status: 'Out for Delivery', title: 'Out for Delivery', desc: 'Courier partner is delivering your order today' },
    { status: 'Delivered', title: 'Delivered', desc: 'Order has been delivered successfully' }
]);

const EXCEPTION_STATUSES = new Set(['Cancelled', 'RTO', 'DTO', 'Collected']);

const getReturnSteps = () => ([
    { status: 'RETURN_REQUESTED', title: 'Return Requested', desc: 'We have received your return request' },
    { status: 'RETURN_PICKED_UP', title: 'Picked Up', desc: 'Item has been picked up by the courier partner' },
    { status: 'REFUND_PROCESSED', title: 'Refund Processed', desc: 'Refund has been initiated successfully' }
]);

const getReplacementSteps = () => ([
    { status: 'REPLACEMENT_REQUESTED', title: 'Replacement Requested', desc: 'Replacement request is being processed' },
    { status: 'REPLACEMENT_PICKED_UP', title: 'Item Picked Up', desc: 'Old item has been picked up' },
    { status: 'REPLACEMENT_SHIPPED', title: 'Replacement Shipped', desc: 'New replacement item is on its way' },
    { status: 'REPLACEMENT_DELIVERED', title: 'Replacement Delivered', desc: 'Replacement item has been delivered' }
]);

const TrackOrder = () => {
    const { orderId, productId } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [trackingData, setTrackingData] = React.useState(null);
    const [trackingLoading, setTrackingLoading] = React.useState(false);
    const [trackingError, setTrackingError] = React.useState('');
    const fulfillmentMode = getFulfillmentMode(order);
    const isDelhiveryMode = fulfillmentMode === 'delhivery';
    const isEkartMode = fulfillmentMode === 'ekart';
    const isCourierMode = isDelhiveryMode || isEkartMode;

    const fetchOrder = async () => {
        try {
            setLoading(true);
            const { data } = await API.get(`/orders/${orderId}`);
            setOrder(data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Order not found.');
            setOrder(null);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchOrder();
    }, [orderId]);

    React.useEffect(() => {
        let cancelled = false;

        const fetchTracking = async () => {
            const trackingIdentifier = getTrackingIdentifier(order, fulfillmentMode);
            if (!isCourierMode || !trackingIdentifier) {
                setTrackingData(null);
                setTrackingError('');
                setTrackingLoading(false);
                return;
            }

            setTrackingLoading(true);
            setTrackingError('');

            try {
                const { data } = await API.get(`/orders/${orderId}/shipping-tracking`);
                if (cancelled) return;
                setTrackingData(data?.tracking || null);
                if (data?.status && order && data.status !== order.status) {
                    fetchOrder();
                }
            } catch (err) {
                if (cancelled) return;
                setTrackingData(null);
                setTrackingError(err.response?.data?.message || 'Unable to fetch live courier status');
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
    }, [fulfillmentMode, isCourierMode, order?.delhivery?.waybill, order?.ekart?.trackingNumber, orderId]);

    const targetItem = (() => {
        if (!productId || !Array.isArray(order?.orderItems)) {
            return order?.orderItems?.[0] || null;
        }

        return order.orderItems.find((item) => (
            String(item?._id) === String(productId) ||
            String(item?.product) === String(productId)
        )) || order.orderItems[0] || null;
    })();

    const currentStatus = productId ? targetItem?.status : order?.status;
    const normalizedCurrentStatus = normalizeOrderStatus(currentStatus);
    const rawCourierStatus = String(trackingData?.currentStatus || '').trim();
    const mappedCourierStep = String(trackingData?.mappedCurrentStep || '').trim();
    const hasCourierException = EXCEPTION_STATUSES.has(mappedCourierStep || rawCourierStatus);

    const returnStatuses = ['RETURN_REQUESTED', 'RETURN_PICKED_UP', 'REFUND_PROCESSED'];
    const replacementStatuses = ['REPLACEMENT_REQUESTED', 'REPLACEMENT_PICKED_UP', 'REPLACEMENT_SHIPPED', 'REPLACEMENT_DELIVERED'];

    const isReturnFlow = returnStatuses.includes(currentStatus);
    const isReplacementFlow = replacementStatuses.includes(currentStatus);

    const steps = isReturnFlow
        ? getReturnSteps()
        : isReplacementFlow
            ? getReplacementSteps()
            : getOrderSteps();

    const effectiveStatus = (() => {
        if (isReplacementFlow && normalizedCurrentStatus === 'Delivered') {
            return 'REPLACEMENT_DELIVERED';
        }

        if (isReturnFlow || isReplacementFlow) {
            return normalizedCurrentStatus;
        }

        if (hasCourierException) {
            return mappedCourierStep || rawCourierStatus;
        }

        if (isCourierMode && mappedCourierStep) {
            return mappedCourierStep;
        }

        if (normalizedCurrentStatus === 'Delivered') return 'Delivered';
        if (steps.some((step) => step.status === normalizedCurrentStatus)) return normalizedCurrentStatus;
        return 'Pending';
    })();

    const currentStatusIdx = steps.findIndex((step) => step.status === effectiveStatus);

    const getStepTime = (stepStatus, stepIndex) => {
        if (isReturnFlow || isReplacementFlow) {
            return '';
        }

        if (stepStatus === 'Pending') return formatTrackingDate(order?.createdAt || order?.date);
        if (stepStatus === 'Confirmed') return formatTrackingDate(isCourierMode ? (order?.delhivery?.syncedAt || order?.ekart?.syncedAt) : (normalizedCurrentStatus !== 'Pending' ? order?.updatedAt : null));
        if (isCourierMode && trackingData?.stepTimes?.[stepStatus]) {
            return formatTrackingDate(trackingData.stepTimes[stepStatus]);
        }
        if (stepStatus === 'Delivered') return formatTrackingDate(order?.deliveredAt);
        if (!isCourierMode && normalizedCurrentStatus === stepStatus) return formatTrackingDate(order?.updatedAt);

        return stepIndex < currentStatusIdx ? '' : '';
    };

    const handleCancel = () => {
        confirmToast({
            message: 'Are you sure you want to cancel this order?',
            type: 'danger',
            icon: 'cancel',
            confirmText: 'Cancel Order',
            onConfirm: async () => {
                try {
                    toast.loading('Cancelling order...', { id: 'track-order-cancel' });
                    await API.post('/returns', {
                        orderId,
                        type: 'Cancellation',
                        reason: 'User requested cancellation'
                    });
                    toast.success('Cancellation request submitted', { id: 'track-order-cancel' });
                    await fetchOrder();
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Unable to cancel order', { id: 'track-order-cancel' });
                }
            }
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white md:bg-[#f1f3f6] flex items-center justify-center">
                <div className="w-14 h-14 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!order) {
        return <div className="p-10 text-center">{error || 'Order not found.'}</div>;
    }

    return (
        <div className="bg-white min-h-screen md:bg-[#f1f3f6] md:py-6">
            <div className="bg-primary-600 text-white px-4 py-4 flex items-center gap-4 sticky top-0 z-50 shadow-md md:hidden">
                <button
                    onClick={() => navigate(productId ? `/my-orders/${orderId}` : '/my-orders')}
                    className="material-icons p-1 -ml-1 active:bg-white/10 rounded-full transition-colors cursor-pointer relative z-[60]"
                    style={{ pointerEvents: 'auto' }}
                >
                    arrow_back
                </button>
                <div className="flex flex-col">
                    <h1 className="text-sm font-bold uppercase tracking-tight">Tracking {productId ? 'Item' : 'Order'}</h1>
                    <span className="text-[10px] text-white/80 uppercase">#{order.displayId || order._id}</span>
                </div>
            </div>

            <div className="md:max-w-[900px] md:mx-auto">
                <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 mb-4 px-4">
                    <span onClick={() => navigate('/')} className="cursor-pointer hover:text-primary-600">Home</span>
                    <span className="material-icons text-[10px]">chevron_right</span>
                    <span onClick={() => navigate('/my-orders')} className="cursor-pointer hover:text-primary-600">My Orders</span>
                    <span className="material-icons text-[10px]">chevron_right</span>
                    <span className="text-gray-800 font-bold">Track Order</span>
                </div>

                <div className="md:bg-white md:rounded-lg md:shadow-sm md:overflow-hidden md:border md:border-gray-200">
                    <div className="p-4 border-b md:bg-gray-50">
                        <div className="flex gap-4">
                            <div className="w-16 h-16 bg-gray-50 rounded border p-1 md:bg-white">
                                <img src={targetItem?.image} alt="" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-sm font-bold text-gray-800 line-clamp-1 md:text-base">{targetItem?.name}</h2>
                                <p className="text-xs text-gray-500 mt-1 md:text-sm">
                                    Status: <span className="text-primary-600 font-bold uppercase tracking-tighter">{String(effectiveStatus || currentStatus || order.status || '').replace(/_/g, ' ')}</span>
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1 hidden md:block">Order ID: {order.displayId || order._id}</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-8">
                        <div className="relative md:pl-4">
                            <div className="absolute left-[9px] md:left-[25px] top-2 bottom-2 w-0.5 bg-gray-100">
                                {order.status !== 'Cancelled' && currentStatusIdx > 0 ? (
                                    <div
                                        className="w-full bg-green-600 transition-all duration-1000 ease-in-out"
                                        style={{
                                            height: `${(currentStatusIdx / Math.max(steps.length - 1, 1)) * 100}%`
                                        }}
                                    />
                                ) : null}
                            </div>

                            <div className="space-y-10">
                                {order.status === 'Cancelled' || hasCourierException ? (
                                    <div className="flex gap-6 relative">
                                        <div className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center z-10 md:w-6 md:h-6">
                                            <span className="material-icons text-white text-[12px] md:text-[14px]">close</span>
                                        </div>
                                        <div className="flex-1 -mt-1 md:mt-0">
                                            <h3 className="text-sm font-bold text-red-600 md:text-base">
                                                {hasCourierException ? `Courier Status: ${mappedCourierStep || rawCourierStatus}` : 'Order Cancelled'}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-0.5 md:text-sm">
                                                {hasCourierException ? `This update came directly from ${getShippingProviderLabel(fulfillmentMode)} tracking.` : 'This order was cancelled.'}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-1 md:text-xs">
                                                {formatTrackingDate(trackingData?.lastUpdatedAt || order.updatedAt || order.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    steps.map((step, idx) => {
                                        const timestamp = getStepTime(step.status, idx);
                                        const isCompleted = Boolean(timestamp) || currentStatusIdx > idx;
                                        const isCurrent = currentStatusIdx === idx;

                                        return (
                                            <div key={step.status} className="flex gap-6 relative">
                                                <div className="relative">
                                                    {isCurrent ? (
                                                        <div className="absolute -inset-1 bg-green-400 rounded-full animate-ping opacity-40" />
                                                    ) : null}
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 relative md:w-6 md:h-6 ${isCompleted || isCurrent ? 'bg-green-600' : 'bg-gray-200'}`}>
                                                        <span className="material-icons text-white text-[12px] md:text-[14px]">
                                                            {isCompleted ? 'check' : isCurrent ? 'radio_button_checked' : 'radio_button_unchecked'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex-1 -mt-1 md:mt-0">
                                                    <h3 className={`text-sm font-bold transition-all duration-500 md:text-base ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                                                        {step.title}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 mt-0.5 md:text-sm">{step.desc}</p>
                                                    {timestamp ? (
                                                        <p className="text-[10px] text-gray-400 mt-1 md:text-xs">{timestamp}</p>
                                                    ) : isCurrent ? (
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                                                            <p className="text-[10px] text-primary-500 font-bold uppercase tracking-wider md:text-xs">In Progress...</p>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {!productId && !['Delivered', 'Cancelled'].includes(normalizeOrderStatus(order.status)) && !hasCourierException ? (
                            <div className="mt-10 pt-6 border-t md:hidden">
                                <button
                                    onClick={handleCancel}
                                    className="w-full text-red-600 font-bold text-sm flex items-center justify-center gap-2 py-2 border border-red-100 rounded-lg active:bg-red-50"
                                >
                                    <span className="material-icons text-sm">cancel</span>
                                    Cancel Order
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>

                {(isCourierMode && (getTrackingIdentifier(order, fulfillmentMode) || trackingLoading || trackingError)) ? (
                    <div className="m-4 p-4 bg-white rounded-xl border border-gray-200 md:mx-0 md:mt-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-bold text-gray-900">Live Courier Tracking</p>
                                <p className="text-[11px] text-gray-500">Real-time status from {getShippingProviderLabel(fulfillmentMode)} after confirmation</p>
                            </div>
                            {getTrackingIdentifier(order, fulfillmentMode) ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            setTrackingLoading(true);
                                            setTrackingError('');
                                            const { data } = await API.get(`/orders/${orderId}/shipping-tracking`);
                                            setTrackingData(data?.tracking || null);
                                        } catch (err) {
                                            setTrackingData(null);
                                            setTrackingError(err.response?.data?.message || 'Unable to refresh courier status');
                                        } finally {
                                            setTrackingLoading(false);
                                        }
                                    }}
                                    className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-primary-600"
                                >
                                    {trackingLoading ? 'Refreshing...' : 'Refresh'}
                                </button>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{getTrackingIdentifierLabel(fulfillmentMode)}</p>
                                <p className="mt-1 text-sm font-black text-gray-900">{getTrackingIdentifier(order, fulfillmentMode) || 'Pending'}</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Courier Step</p>
                                <p className="mt-1 text-sm font-black text-emerald-700 uppercase">{mappedCourierStep || rawCourierStatus || 'Awaiting live update'}</p>
                            </div>
                            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Last Updated</p>
                                <p className="mt-1 text-sm font-black text-gray-900">{formatTrackingDate(trackingData?.lastUpdatedAt) || 'Pending'}</p>
                            </div>
                        </div>

                        {rawCourierStatus ? (
                            <div className="rounded-xl border border-primary-100 bg-primary-50 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary-700">Raw {getShippingProviderLabel(fulfillmentMode)} Status</p>
                                <p className="mt-1 text-sm font-semibold text-primary-900">{rawCourierStatus}</p>
                            </div>
                        ) : null}

                        {trackingData?.currentLocation ? (
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Current Location</p>
                                <p className="mt-1 text-sm font-semibold text-emerald-900">{trackingData.currentLocation}</p>
                            </div>
                        ) : null}

                        {trackingLoading ? (
                            <div className="rounded-xl border border-primary-100 bg-primary-50 p-3 text-sm font-semibold text-primary-600">
                                Fetching live {getShippingProviderLabel(fulfillmentMode)} status...
                            </div>
                        ) : null}

                        {trackingError ? (
                            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-700">
                                {trackingError}
                            </div>
                        ) : null}

                        {trackingData?.scans?.length ? (
                            <div className="space-y-3">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Tracking Updates</p>
                                <div className="space-y-2">
                                    {trackingData.scans.slice(0, 6).map((scan, index) => (
                                        <div key={`${scan.time || scan.status}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-black text-gray-900 uppercase">{scan.status || 'Update received'}</p>
                                                    <p className="mt-1 text-xs text-gray-600">{scan.location || 'Location not available'}</p>
                                                </div>
                                                <p className="text-[10px] text-gray-500 font-bold text-right">{formatTrackingDate(scan.time) || 'Pending'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}

                <div className="m-4 p-4 bg-primary-50 rounded-xl border border-primary-100 md:mx-0 md:mt-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-primary-600 shadow-sm">
                            <span className="material-icons">support_agent</span>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-primary-900">Need help with tracking?</p>
                            <p className="text-[11px] text-primary-700">Call our customer support at 1800-202-9898</p>
                        </div>
                        <button className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:bg-primary-700 transition-colors">Call Now</button>
                    </div>
                </div>

                <div className="px-6 py-4 mt-4 border-t md:bg-white md:rounded-lg md:shadow-sm md:border md:border-gray-200 md:px-6 md:py-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">{isCourierMode ? 'Courier details' : 'Fulfillment details'}</h4>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-800">{isCourierMode ? getShippingProviderLabel(fulfillmentMode) : 'Manual fulfillment'}</p>
                            <p className="text-xs text-gray-500 uppercase mt-0.5">
                                {isCourierMode ? `${getTrackingIdentifierLabel(fulfillmentMode)}: ${getTrackingIdentifier(order, fulfillmentMode) || 'Pending'}` : 'Status updated by admin team'}
                            </p>
                        </div>
                        <span className="material-icons text-gray-400">chevron_right</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackOrder;
