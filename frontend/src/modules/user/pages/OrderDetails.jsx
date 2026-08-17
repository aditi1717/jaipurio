import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import API from '../../../services/api';
import { toast } from 'react-hot-toast';
import { confirmToast } from '../../../utils/toastUtils.jsx';
import InvoiceGenerator from '../../admin/components/orders/InvoiceGenerator';
import { getFulfillmentMode, getShippingProviderLabel, getTrackingIdentifier, getShippingSyncedAt } from '../../../utils/shippingProvider';
import { useAuthStore } from '../store/authStore';

const RETURN_WINDOW_DAYS = 7;
const RETURN_CONSUMING_STATUSES = new Set([
    'Pending',
    'Approved',
    'Pickup Scheduled',
    'Received at Warehouse',
    'Refund Initiated',
    'Replacement Dispatched',
    'Completed'
]);
const RETURN_LOCKING_STATUSES = new Set([
    'Pending',
    'Approved',
    'Pickup Scheduled',
    'Received at Warehouse',
    'Refund Initiated',
    'Replacement Dispatched',
    'Completed',
    'Rejected'
]);

const normalizeReturnVariant = (value) => (value && typeof value === 'object' ? value : {});
const isSameVariant = (first = {}, second = {}) => JSON.stringify(first || {}) === JSON.stringify(second || {});
const doesReturnMatchOrderItem = (ret, item) => {
    if (!ret || !item) return false;

    if (ret.orderItemId) {
        return String(ret.orderItemId) === String(item?._id);
    }

    const sameProductId = ret?.product?.id !== undefined && String(ret.product.id) === String(item?.product);
    const sameVariant = isSameVariant(normalizeReturnVariant(ret?.product?.variant), normalizeReturnVariant(item?.variant));
    const sameName = String(ret?.product?.name || '').trim() === String(item?.name || '').trim();

    return (sameProductId && sameVariant) || (sameName && sameVariant);
};

const buildEstimatedDeliveryText = (deliveryTime, unit) => {
    const timeValue = Number(deliveryTime);
    const normalizedUnit = String(unit || '').toLowerCase();
    if (!Number.isFinite(timeValue) || timeValue <= 0 || !normalizedUnit) {
        return '';
    }

    const now = new Date();
    const eta = new Date(now.getTime());

    if (normalizedUnit === 'days') {
        eta.setDate(eta.getDate() + timeValue);
    } else if (normalizedUnit === 'hours') {
        eta.setHours(eta.getHours() + timeValue);
    } else if (normalizedUnit === 'minutes') {
        eta.setMinutes(eta.getMinutes() + timeValue);
    } else {
        return '';
    }

    const dateLabel = eta.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
    const unitLabel = timeValue === 1 ? normalizedUnit.slice(0, -1) : normalizedUnit;
    return `Estimated delivery by ${dateLabel} (${timeValue} ${unitLabel})`;
};

const normalizeReturnTrackingStatus = (status) => {
    const raw = String(status || '').trim();
    if (raw === 'Return Requested' || raw === 'Replacement Requested') return 'Pending';
    if (raw === 'Returned' || raw === 'Replaced') return 'Completed';
    if (raw === 'Return Rejected') return 'Rejected';
    return raw;
};

const getReturnLifecycleSteps = (type) => {
    if (type === 'Cancellation') return ['Pending', 'Approved', 'Completed'];
    if (type === 'Replacement') return ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Replacement Dispatched', 'Completed'];
    return ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Refund Initiated', 'Completed'];
};

const getReturnStatusLabel = (type, status) => {
    const normalizedType = String(type || '').trim();
    if (normalizedType === 'Return' && String(status || '').trim() === 'Completed') {
        return 'Returned';
    }
    if (normalizedType === 'Replacement' && String(status || '').trim() === 'Completed') {
        return 'Replaced';
    }
    return status;
};

const formatReturnTimelineDate = (value) => {
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

const formatExpectedDeliveryText = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return `Estimated delivery by ${parsed.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    })}`;
};

const isEligibleForNewReturnRequest = (status) => {
    const normalized = String(status || '').trim().toLowerCase();

    if (!normalized || normalized === 'delivered') return true;
    if (normalized === 'rejected' || normalized === 'return rejected') return true;

    const blockedStatuses = new Set([
        'return requested',
        'replacement requested',
        'approved',
        'pickup scheduled',
        'received at warehouse',
        'refund initiated',
        'replacement dispatched',
        'returned',
        'replaced',
        'completed'
    ]);

    return !blockedStatuses.has(normalized);
};

const normalizeOrderStatus = (status = '') => {
    const value = String(status || '').trim();
    if (value === 'Shipped') return 'Dispatched';
    return value;
};

const EXCEPTION_STATUSES = new Set(['Cancelled', 'RTO', 'DTO', 'Collected']);
const getDefaultReviewDraft = () => ({ rating: 5, comment: '' });

const OrderDetails = () => {
    const { orderId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [settings, setSettings] = useState(null);
    const [myReturns, setMyReturns] = useState([]);
    const [reviewDrafts, setReviewDrafts] = useState({});
    const [existingReviewsByProduct, setExistingReviewsByProduct] = useState({});
    const [submittingReviewFor, setSubmittingReviewFor] = useState('');
    const [trackingData, setTrackingData] = useState(null);
    const [deliveryEstimate, setDeliveryEstimate] = useState({
        loading: false,
        isServiceable: null,
        text: ''
    });
    const fulfillmentMode = getFulfillmentMode(order);
    const isCourierMode = fulfillmentMode === 'delhivery' || fulfillmentMode === 'ekart';

    useEffect(() => {
        fetchOrderDetails();
        fetchSettings();
    }, [orderId]);

    useEffect(() => {
        const fetchMyReturns = async () => {
            try {
                const { data } = await API.get('/returns/my-returns');
                setMyReturns(Array.isArray(data) ? data : []);
            } catch (err) {
                setMyReturns([]);
            }
        };
        fetchMyReturns();
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchTracking = async () => {
            if (!isCourierMode || !getTrackingIdentifier(order, fulfillmentMode)) {
                setTrackingData(null);
                return;
            }

            try {
                const { data } = await API.get(`/orders/${orderId}/shipping-tracking`);
                if (cancelled) return;
                setTrackingData(data?.tracking || null);
            } catch (err) {
                if (cancelled) return;
                setTrackingData(null);
            }
        };

        fetchTracking();

        return () => {
            cancelled = true;
        };
    }, [fulfillmentMode, isCourierMode, order?.delhivery?.waybill, order?.ekart?.trackingNumber, orderId]);

    useEffect(() => {
        const delivered = String(trackingData?.currentStatus || '').trim() === 'Delivered'
            || normalizeOrderStatus(order?.status) === 'Delivered'
            || Boolean(order?.isDelivered);

        if (delivered) {
            setDeliveryEstimate({ loading: false, isServiceable: null, text: '' });
            return;
        }

        const expectedDeliveryText = formatExpectedDeliveryText(trackingData?.expectedDeliveryDate);
        setDeliveryEstimate({
            loading: false,
            isServiceable: expectedDeliveryText ? true : null,
            text: expectedDeliveryText
        });
    }, [trackingData?.expectedDeliveryDate, trackingData?.currentStatus, order?.status, order?.isDelivered]);

    const fetchSettings = async () => {
        try {
            const { data } = await API.get('/settings');
            setSettings(data);
        } catch (err) {
            console.error('Fetch settings error:', err);
        }
    };

    const fetchOrderDetails = async () => {
        try {
            setLoading(true);
            const { data } = await API.get(`/orders/${orderId}`);
            setOrder(data);
            setError(null);
        } catch (err) {
            console.error('Fetch order details error:', err);
            setError(err.response?.data?.message || 'Failed to fetch order details');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelOrder = async () => {
        confirmToast({
            message: 'Are you sure you want to cancel this order?\nIf it was prepaid and not delivered yet, the refund will be started automatically.',
            type: 'warning',
            icon: 'report_problem',
            confirmText: 'Cancel Order',
            onConfirm: async () => {
                try {
                    toast.loading('Cancelling order...', { id: 'cancel-order' });
                    await API.post(`/returns`, { 
                        orderId: order._id,
                        type: 'Cancellation',
                        reason: 'User requested cancellation'
                    });
                    toast.success('Order cancelled successfully!', { id: 'cancel-order' });
                    fetchOrderDetails(); // Refresh details
                } catch (err) {
                    console.error('Cancel order error:', err);
                    toast.error(err.response?.data?.message || 'Failed to cancel order', { id: 'cancel-order' });
                }
            }
        });
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
            'Cancelled': 'bg-red-100 text-red-800 border-red-200',
            'Cancellation Requested': 'bg-orange-100 text-orange-800 border-orange-200',
            'Return Requested': 'bg-orange-100 text-orange-800 border-orange-200',
            'Replacement Requested': 'bg-primary-100 text-primary-800 border-primary-200',
            'Approved': 'bg-teal-100 text-teal-800 border-teal-200',
            'Pickup Scheduled': 'bg-purple-100 text-purple-800 border-purple-200',
            'Received at Warehouse': 'bg-indigo-100 text-indigo-800 border-indigo-200',
            'Refund Initiated': 'bg-cyan-100 text-cyan-800 border-cyan-200',
            'Replacement Dispatched': 'bg-pink-100 text-pink-800 border-pink-200',
            'Returned': 'bg-gray-100 text-gray-800 border-gray-200',
            'Replaced': 'bg-green-100 text-green-800 border-green-200',
            'Completed': 'bg-green-100 text-green-800 border-green-200',
            'Rejected': 'bg-red-50 text-red-800 border-red-200',
            'Return Rejected': 'bg-red-50 text-red-800 border-red-200'
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
            'Cancelled': 'cancel',
            'Cancellation Requested': 'hourglass_empty',
            'Return Requested': 'assignment_return',
            'Replacement Requested': 'sync',
            'Approved': 'thumb_up',
            'Pickup Scheduled': 'local_shipping',
            'Received at Warehouse': 'warehouse',
            'Refund Initiated': 'currency_rupee',
            'Replacement Dispatched': 'local_shipping',
            'Returned': 'keyboard_return',
            'Replaced': 'published_with_changes',
            'Completed': 'check_circle',
            'Rejected': 'cancel',
            'Return Rejected': 'cancel'
        };
        return icons[status] || 'info';
    };

    const steps = [
        { name: 'Pending', status: 'Pending', icon: 'shopping_cart' },
        { name: 'Confirmed', status: 'Confirmed', icon: 'check_circle' },
        { name: 'Packed', status: 'Packed', icon: 'inventory_2' },
        { name: 'Manifested', status: 'Manifested', icon: 'inventory_2' },
        { name: 'Not Picked', status: 'Not Picked', icon: 'schedule' },
        { name: 'Picked Up', status: 'Picked Up', icon: 'inventory_2' },
        { name: 'Scheduled', status: 'Scheduled', icon: 'event' },
        { name: 'Dispatched', status: 'Dispatched', icon: 'local_shipping' },
        { name: 'In Transit', status: 'In Transit', icon: 'sync_alt' },
        { name: 'Out for Delivery', status: 'Out for Delivery', icon: 'delivery_dining' },
        { name: 'Delivered', status: 'Delivered', icon: 'done_all' }
    ];
    const normalizedOrderStatus = normalizeOrderStatus(order?.status);
    const rawCourierStatus = String(trackingData?.currentStatus || '').trim();
    const mappedCourierStep = String(trackingData?.mappedCurrentStep || '').trim();
    const hasCourierException = isCourierMode && EXCEPTION_STATUSES.has(rawCourierStatus);
    const rawTrackingScans = Array.isArray(trackingData?.scans) ? trackingData.scans : [];
    const scanTimeByStatus = rawTrackingScans.reduce((acc, scan) => {
        const key = String(scan?.status || '').trim();
        if (!key || !scan?.time || acc[key]) return acc;
        acc[key] = scan.time;
        return acc;
    }, {});
    const liveDeliveredAt = scanTimeByStatus.Delivered
        || (rawCourierStatus === 'Delivered' ? trackingData?.lastUpdatedAt || null : null);
    const displayOrderStatus = (() => {
        if (normalizedOrderStatus === 'Cancelled' || normalizedOrderStatus === 'Cancellation Requested') {
            return normalizedOrderStatus;
        }
        if (hasCourierException) return rawCourierStatus;
        if (isCourierMode && mappedCourierStep) return mappedCourierStep;
        if (isCourierMode && rawCourierStatus && steps.some((step) => step.status === rawCourierStatus)) return rawCourierStatus;
        if (steps.some((step) => step.status === normalizedOrderStatus)) return normalizedOrderStatus;
        return normalizedOrderStatus || 'Pending';
    })();
    const currentStep = steps.findIndex((step) => step.status === displayOrderStatus);
    const orderProgress = steps.length > 1 && currentStep >= 0
        ? (currentStep / (steps.length - 1)) * 100
        : 0;
    const effectiveDeliveredAt = liveDeliveredAt || order?.deliveredAt || null;
    const isDeliveredOrder = displayOrderStatus === 'Delivered' || Boolean(effectiveDeliveredAt) || Boolean(order?.isDelivered);
    const itemReturnMetaById = useMemo(() => {
        const out = {};
        const orderKey = String(order?._id || '');
        (order?.orderItems || []).forEach((item) => {
            const orderedQty = Math.max(1, Number(item?.qty || item?.quantity || 1));
            const matchingReturns = myReturns.filter((ret) =>
                String(ret?.orderId || '') === orderKey &&
                String(ret?.type || '') !== 'Cancellation' &&
                doesReturnMatchOrderItem(ret, item)
            );

            let consumedQty = 0;
            let latestRejectedReason = '';
            let hasAnyReturnRequest = false;

            matchingReturns.forEach((ret) => {
                const requestQty = Math.max(1, Number(ret?.requestedQuantity || 1));
                const normalizedStatus = String(ret?.status || '').trim();
                const timeline = Array.isArray(ret.timeline) ? ret.timeline : [];

                if (RETURN_LOCKING_STATUSES.has(normalizedStatus)) {
                    hasAnyReturnRequest = true;
                }

                if (normalizedStatus === 'Rejected') {
                    const latestRejected = [...timeline].reverse().find((entry) => String(entry?.status || '').trim() === 'Rejected');
                    if (!latestRejectedReason) {
                        latestRejectedReason = String(latestRejected?.note || '').trim();
                    }
                    return;
                }

                if (RETURN_CONSUMING_STATUSES.has(normalizedStatus)) {
                    consumedQty += requestQty;
                }
            });

            out[String(item._id)] = {
                orderedQty,
                consumedQty,
                hasAnyReturnRequest,
                remainingQty: Math.max(0, orderedQty - consumedQty),
                latestRejectedReason
            };
        });
        return out;
    }, [myReturns, order?._id, order?.orderItems]);
    const orderReturnRequests = useMemo(() => {
        const orderKey = String(order?._id || '');
        return myReturns
            .filter((ret) => String(ret?.orderId || '') === orderKey)
            .sort((a, b) => new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0));
    }, [myReturns, order?._id]);
    const paymentMethodValue = String(order?.paymentMethod || '').trim().toUpperCase();
    const isOnlinePaidOrder = Boolean(order?.isPaid) && paymentMethodValue && paymentMethodValue !== 'COD';
    const paymentInfoStatus = isOnlinePaidOrder
        ? 'Completed'
        : (order?.isPaid || ['Confirmed', 'Packed', 'Manifested', 'Not Picked', 'Picked Up', 'Scheduled', 'Dispatched', 'In Transit', 'Out for Delivery', 'Delivered'].includes(displayOrderStatus)
            ? 'Completed'
            : 'Pending');
    const isWithinReturnWindow = useMemo(() => {
        const deliveredAt = effectiveDeliveredAt ? new Date(effectiveDeliveredAt) : null;
        if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) return false;

        const diffMs = Date.now() - deliveredAt.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= RETURN_WINDOW_DAYS;
    }, [effectiveDeliveredAt]);
    const deliveredProductIds = useMemo(() => {
        if (!isDeliveredOrder || !Array.isArray(order?.orderItems)) return [];

        return [...new Set(
            order.orderItems
                .map((item) => String(item?.product || '').trim())
                .filter(Boolean)
        )];
    }, [isDeliveredOrder, order?.orderItems]);

    useEffect(() => {
        if (!deliveredProductIds.length) {
            setReviewDrafts({});
            return;
        }

        setReviewDrafts((prev) => {
            const next = { ...prev };
            deliveredProductIds.forEach((productId) => {
                if (!next[productId]) {
                    next[productId] = getDefaultReviewDraft();
                }
            });
            return next;
        });
    }, [deliveredProductIds]);

    useEffect(() => {
        if (!isDeliveredOrder || !user?._id || !deliveredProductIds.length) {
            setExistingReviewsByProduct({});
            return;
        }

        let cancelled = false;

        const fetchExistingReviews = async () => {
            try {
                const results = await Promise.all(
                    deliveredProductIds.map(async (productId) => {
                        const { data } = await API.get(`/reviews/product/${productId}`);
                        return {
                            productId,
                            reviews: Array.isArray(data) ? data : []
                        };
                    })
                );

                if (cancelled) return;

                const next = {};
                results.forEach(({ productId, reviews }) => {
                    const myReview = reviews.find((review) => String(review?.user) === String(user._id));
                    if (myReview) {
                        next[productId] = myReview;
                    }
                });
                setExistingReviewsByProduct(next);
            } catch (err) {
                if (!cancelled) {
                    console.error('Fetch existing reviews error:', err);
                    setExistingReviewsByProduct({});
                }
            }
        };

        fetchExistingReviews();

        return () => {
            cancelled = true;
        };
    }, [deliveredProductIds, isDeliveredOrder, user?._id]);

    const updateReviewDraft = (productId, updates) => {
        const key = String(productId || '').trim();
        if (!key) return;

        setReviewDrafts((prev) => ({
            ...prev,
            [key]: {
                ...(prev[key] || getDefaultReviewDraft()),
                ...updates
            }
        }));
    };

    const handleSubmitReview = async (item) => {
        const productId = String(item?.product || '').trim();
        if (!productId) {
            toast.error('Review cannot be submitted for this item.');
            return;
        }

        const draft = reviewDrafts[productId] || getDefaultReviewDraft();
        const comment = String(draft.comment || '').trim();

        if (!comment) {
            toast.error('Please write a short review before submitting.');
            return;
        }

        try {
            setSubmittingReviewFor(productId);
            const { data } = await API.post('/reviews', {
                productId: item.product,
                rating: draft.rating,
                comment
            });

            setExistingReviewsByProduct((prev) => ({
                ...prev,
                [productId]: {
                    ...data,
                    user: user?._id || data?.user,
                    name: user?.name || data?.name || 'You'
                }
            }));
            setReviewDrafts((prev) => ({
                ...prev,
                [productId]: getDefaultReviewDraft()
            }));
            toast.success('Your review has been published successfully!');
        } catch (err) {
            console.error('Submit review error:', err);
            toast.error(err.response?.data?.message || 'Failed to submit review. Please try again.');
        } finally {
            setSubmittingReviewFor('');
        }
    };

    const getStepTimestamp = (stepStatus, stepIndex) => {
        if (stepStatus === 'Pending') return formatTrackingDate(order?.createdAt);
        if (stepStatus === 'Confirmed') return formatTrackingDate(isCourierMode ? getShippingSyncedAt(order, fulfillmentMode) : (normalizedOrderStatus !== 'Pending' ? order?.updatedAt : null));
        if (isCourierMode && scanTimeByStatus[stepStatus]) return formatTrackingDate(scanTimeByStatus[stepStatus]);
        if (stepStatus === 'Delivered') return formatTrackingDate(effectiveDeliveredAt);
        if (!isCourierMode && normalizedOrderStatus === stepStatus) return formatTrackingDate(order?.updatedAt);
        if (stepIndex < currentStep) return '';
        return '';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-semibold">Loading order details...</p>
                </div>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-4">
                <div className="text-center bg-white p-10 rounded-xl shadow-lg">
                    <span className="material-icons text-red-400 text-6xl mb-4">error</span>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
                    <p className="text-gray-600 mb-6">{error || 'Unable to load order details'}</p>
                    <button onClick={() => navigate('/my-orders')} className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-bold transition-all">
                        Back to Orders
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white px-4 py-5 sticky top-[110px] md:top-[96px] z-30 shadow-sm border-b border-gray-200">
                <div className="max-w-6xl mx-auto flex items-center gap-4">
                    <button
                        onClick={() => navigate('/my-orders')}
                        className="material-icons p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                    >
                        arrow_back
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-gray-900">Order Details</h1>
                        <p className="text-xs text-gray-500">#{order.displayId || order._id.slice(-8).toUpperCase()}</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 ${getStatusColor(displayOrderStatus)}`}>
                        <span className="material-icons text-sm">{getStatusIcon(displayOrderStatus)}</span>
                        {displayOrderStatus}
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-3 md:px-2 lg:px-1 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Order Status Timeline */}
                        {order.status !== 'Cancelled' && order.status !== 'Cancellation Requested' && !hasCourierException && (
                            <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <span className="material-icons text-gray-700">local_shipping</span>
                                    Track Your Order
                                </h2>
                                <div className="md:hidden">
                                    <div className="relative pl-4">
                                        <div className="absolute left-[33px] top-3 bottom-3 w-0.5 -translate-x-1/2 bg-primary-100">
                                            {currentStep > 0 ? (
                                                <div
                                                    className="w-full bg-primary-600 transition-all duration-500"
                                                    style={{ height: `${(currentStep / Math.max(steps.length - 1, 1)) * 100}%` }}
                                                />
                                            ) : null}
                                        </div>
                                        <div className="space-y-6">
                                            {steps.map((step, index) => {
                                                const stepTimestamp = getStepTimestamp(step.status, index);
                                                const isCompleted = Boolean(stepTimestamp) || index <= currentStep;
                                                const isCurrent = index === currentStep;

                                                return (
                                                    <div key={step.status} className="relative flex gap-4 z-10">
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${isCompleted
                                                            ? 'bg-primary-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]'
                                                            : 'bg-white border-2 border-primary-100 text-gray-400 shadow-sm'
                                                            } ${isCurrent ? 'ring-4 ring-primary-200' : ''}`}>
                                                            <span className="material-icons text-base">{step.icon}</span>
                                                        </div>
                                                        <div className="pt-0.5">
                                                            <p className={`text-sm font-bold leading-tight ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                                                {step.name}
                                                            </p>
                                                            {stepTimestamp ? (
                                                                <span className="mt-1 block text-[10px] text-gray-500 font-semibold leading-tight">{stepTimestamp}</span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="hidden md:block pb-1">
                                    <div className="relative w-full rounded-2xl border border-primary-50 bg-white px-3 py-4 md:px-3 md:py-4">
                                        {/* Progress Bar */}
                                        <div className="absolute left-[42px] right-[42px] top-[34px] h-0.5 rounded-full bg-primary-100">
                                            <div
                                                className="h-full rounded-full bg-primary-600 transition-all duration-500"
                                                style={{ width: `${orderProgress}%` }}
                                            ></div>
                                        </div>

                                        {/* Steps */}
                                        <div className="grid grid-cols-10 gap-x-1">
                                        {steps.map((step, index) => {
                                            const stepTimestamp = getStepTimestamp(step.status, index);
                                            const isCompleted = Boolean(stepTimestamp) || index <= currentStep;
                                            const isCurrent = index === currentStep;
                                            return (
                                                <div key={step.status} className="flex flex-col items-center relative z-10 px-0.5 min-w-0">
                                                    <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${isCompleted
                                                            ? 'bg-primary-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]'
                                                            : 'bg-white border-2 border-primary-100 text-gray-400 shadow-sm'
                                                        } ${isCurrent ? 'ring-4 ring-primary-200 scale-110' : ''}`}>
                                                        <span className="material-icons text-sm md:text-base">{step.icon}</span>
                                                    </div>
                                                    <p className={`text-[9px] md:text-[11px] font-bold text-center leading-tight ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
                                                        {step.name}
                                                    </p>
                                                    {stepTimestamp ? (
                                                        <span className="mt-1 text-[9px] text-gray-500 font-semibold text-center leading-tight">{stepTimestamp}</span>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {hasCourierException && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100">
                                <h2 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
                                    <span className="material-icons text-red-600">warning</span>
                                    Courier Exception
                                </h2>
                                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-widest text-red-700">Live {getShippingProviderLabel(fulfillmentMode)} Status</p>
                                    <p className="mt-2 text-xl font-black text-red-800 uppercase">{rawCourierStatus}</p>
                                    <p className="mt-2 text-sm text-red-700">This update came directly from {getShippingProviderLabel(fulfillmentMode)} tracking.</p>
                                    <p className="mt-2 text-xs font-semibold text-red-800">{formatTrackingDate(trackingData?.lastUpdatedAt || order?.updatedAt)}</p>
                                </div>
                            </div>
                        )}

                        {/* Return Status Timeline */}
                        {orderReturnRequests.length > 0 && (
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <span className="material-icons text-gray-700">assignment_return</span>
                                    Item-wise Return / Replacement Tracking
                                </h2>
                                <div className="space-y-4">
                                    {orderReturnRequests.map((ret) => {
                                        const timeline = Array.isArray(ret?.timeline) ? ret.timeline : [];
                                        const latestEntry = timeline.length > 0 ? timeline[timeline.length - 1] : null;
                                        const currentStatus = normalizeReturnTrackingStatus(latestEntry?.status || ret?.status || 'Pending');
                                        const currentStatusLabel = getReturnStatusLabel(ret?.type, currentStatus);
                                        const baseStepsForType = getReturnLifecycleSteps(ret?.type);
                                        const stepsForType = currentStatus === 'Rejected'
                                            ? [...baseStepsForType, 'Rejected']
                                            : baseStepsForType;
                                        const currentStepIndex = stepsForType.indexOf(currentStatus);
                                        const safeStepIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
                                        const returnProgress = stepsForType.length > 1
                                            ? (safeStepIndex / (stepsForType.length - 1)) * 100
                                            : 0;
                                        const latestRejected = [...timeline].reverse().find((entry) => normalizeReturnTrackingStatus(entry?.status) === 'Rejected');
                                        const rejectReason = String(latestRejected?.note || '').trim();
                                        const productName = String(ret?.product?.name || 'Product').trim();

                                        return (
                                            <div key={ret?._id || ret?.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/40">
                                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{productName}</p>
                                                        <p className="text-xs text-gray-600">
                                                            {ret?.type || 'Return'} Request
                                                            {ret?.requestedQuantity ? ` • Qty ${ret.requestedQuantity}` : ''}
                                                            {latestEntry?.time ? ` • ${formatReturnTimelineDate(latestEntry.time)}` : ''}
                                                        </p>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusColor(currentStatusLabel)}`}>
                                                        <span className="material-icons text-[14px]">{getStatusIcon(currentStatusLabel)}</span>
                                                        {currentStatusLabel}
                                                    </span>
                                                </div>

                                                {currentStatus === 'Rejected' && (
                                                    <p className="text-xs font-semibold text-red-700 mb-3">
                                                        Reject reason: {rejectReason || 'No reason shared'}
                                                    </p>
                                                )}

                                                {currentStatus === 'Rejected' ? (
                                                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center shadow-[0_10px_24px_rgba(239,68,68,0.22)]">
                                                                <span className="material-icons text-xl">cancel</span>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-red-700">Request Rejected</p>
                                                                <p className="text-xs text-red-600 mt-1">
                                                                    This return/replacement request was rejected by the review team.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="pb-2">
                                                        <div className="relative w-full">
                                                            <div
                                                                className="absolute left-[calc(100%/(var(--steps)*2))] right-[calc(100%/(var(--steps)*2))] top-5 h-1.5 -translate-y-1/2 rounded-full bg-primary-100"
                                                                style={{ '--steps': stepsForType.length }}
                                                            >
                                                                <div
                                                                    className="h-full rounded-full transition-all duration-300 bg-primary-600"
                                                                    style={{
                                                                        width: `${returnProgress}%`
                                                                    }}
                                                                />
                                                            </div>

                                                            <div
                                                                className="grid gap-0"
                                                                style={{ gridTemplateColumns: `repeat(${stepsForType.length}, minmax(0, 1fr))` }}
                                                            >
                                                                {stepsForType.map((stepName, idx) => {
                                                                    const done = idx <= safeStepIndex;
                                                                    const active = idx === safeStepIndex;
                                                                    const stepLabel = getReturnStatusLabel(ret?.type, stepName);
                                                                    return (
                                                                        <div key={`${ret?._id || ret?.id}-${stepName}`} className="flex flex-col items-center relative z-10 px-1">
                                                                            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
                                                                                done
                                                                                    ? 'bg-primary-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]'
                                                                                    : 'bg-white border-2 border-primary-100 text-gray-400 shadow-sm'
                                                                            } ${active ? 'ring-4 ring-primary-100 scale-110' : ''}`}>
                                                                                <span className="material-icons text-base md:text-lg">{getStatusIcon(stepLabel)}</span>
                                                                            </div>
                                                                            <p className={`text-[9px] md:text-[11px] font-semibold text-center leading-tight break-words ${done ? 'text-gray-800' : 'text-gray-500'}`}>
                                                                                {stepLabel}
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Cancellation Requested status */}
                        {order.status === 'Cancellation Requested' && (
                            <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className="material-icons text-amber-700 text-4xl animate-pulse">hourglass_empty</span>
                                    <div>
                                        <h3 className="text-xl font-bold text-amber-900">Cancellation Requested</h3>
                                        <p className="text-sm text-amber-800 mt-1">Your request is being reviewed by our team. You'll be notified once it's approved.</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Cancelled Status */}
                        {order.status === 'Cancelled' && (
                            <div className="bg-red-50 border border-red-200 p-6 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className="material-icons text-red-600 text-4xl">cancel</span>
                                    <div>
                                        <h3 className="text-xl font-bold text-red-800">Order Cancelled</h3>
                                        <p className="text-sm text-red-600 mt-1">This order has been cancelled</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Order Items */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="material-icons text-gray-700">shopping_bag</span>
                                Items in Order ({order.orderItems.length})
                            </h2>
                            <div className="space-y-4">
                                {order.orderItems.map((item, index) => {
                                    const itemMeta = itemReturnMetaById[String(item._id)] || {
                                        orderedQty: Math.max(1, Number(item?.qty || item?.quantity || 1)),
                                        consumedQty: 0,
                                        hasAnyReturnRequest: false,
                                        remainingQty: Math.max(1, Number(item?.qty || item?.quantity || 1)),
                                        latestRejectedReason: ''
                                    };
                                    const hasPartialRequest = itemMeta.consumedQty > 0 && itemMeta.consumedQty < itemMeta.orderedQty;
                                    const derivedStatus = hasPartialRequest
                                        ? `${itemMeta.consumedQty}/${itemMeta.orderedQty} units in return flow`
                                        : (item.status && item.status !== order.status ? item.status : '');
                                    const reviewProductKey = String(item?.product || '').trim();
                                    const reviewDraft = reviewDrafts[reviewProductKey] || getDefaultReviewDraft();
                                    const existingReview = existingReviewsByProduct[reviewProductKey];
                                    const isSubmittingReview = submittingReviewFor === reviewProductKey;

                                    return (
                                    <div key={index} className="flex gap-4 p-4 bg-white rounded-lg border border-gray-200">
                                        <div className="w-20 h-20 bg-white rounded-lg border border-gray-200 p-2 flex-shrink-0">
                                            <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-sm font-bold text-gray-800 line-clamp-2">{item.name}</h3>
                                                    {item.variant && (
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                                            {Object.entries(item.variant).map(([key, value]) => (
                                                                <span key={key} className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
                                                                    {key}: <span className="text-gray-700">{value}</span>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {(item.serialNumber && (normalizedOrderStatus === 'Delivered' || order.isDelivered)) && (
                                                        <div className="mt-2">
                                                            <span className="text-sm bg-gray-100 text-gray-800 px-3 py-1.5 rounded-lg font-bold font-mono border border-gray-300 shadow-sm flex items-center gap-2 w-max select-all">
                                                    <span className="text-gray-500 select-none">{item.serialType === 'IMEI' ? 'IMEI:' : 'SN:'}</span> {item.serialNumber}
                                                </span>
                                                        </div>
                                                    )}
                                            <p className="text-xs text-gray-500 mt-1">
                                                Quantity: {item.qty}
                                                {itemMeta.consumedQty > 0 ? ` | Requested: ${itemMeta.consumedQty}` : ''}
                                            </p>
                                            <p className="text-lg font-extrabold text-gray-900 mt-1">
                                                Rs. {item.price.toLocaleString()}
                                            </p>

                                            {/* Item Status Badge */}
                                            {derivedStatus && (
                                                <>
                                                    <div className={`mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${hasPartialRequest ? 'bg-primary-50 text-primary-700 border-primary-200' : getStatusColor(derivedStatus)}`}>
                                                        <span className="material-icons text-[14px]">{hasPartialRequest ? 'inventory_2' : getStatusIcon(derivedStatus)}</span>
                                                        {derivedStatus}
                                                    </div>
                                                    {!!itemMeta.latestRejectedReason && (
                                                        <p className="mt-2 text-xs text-red-700 font-semibold">
                                                            Reject reason: {itemMeta.latestRejectedReason}
                                                        </p>
                                                    )}
                                                </>
                                            )}

                                            {isDeliveredOrder && reviewProductKey && (
                                                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-bold text-gray-900">Rate this product</p>
                                                            <p className="text-xs text-gray-500">Your review will be visible immediately on the product page.</p>
                                                        </div>
                                                        {existingReview && (
                                                            <span className="rounded-full bg-green-100 px-3 py-1 text-[11px] font-bold text-green-700">
                                                                Reviewed
                                                            </span>
                                                        )}
                                                    </div>

                                                    {existingReview ? (
                                                        <div className="mt-3 rounded-xl border border-green-100 bg-white p-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex items-center gap-1 rounded-lg bg-green-600 px-2 py-1 text-xs font-bold text-white">
                                                                    {existingReview.rating}
                                                                    <span className="material-icons !text-[14px]">star</span>
                                                                </div>
                                                                <span className="text-xs font-semibold text-gray-500">
                                                                    {existingReview.createdAt ? new Date(existingReview.createdAt).toLocaleDateString('en-IN') : 'Just now'}
                                                                </span>
                                                            </div>
                                                            <p className="mt-2 text-sm text-gray-700">{existingReview.comment}</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="mt-3 flex gap-2">
                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                    <button
                                                                        key={star}
                                                                        type="button"
                                                                        onClick={() => updateReviewDraft(reviewProductKey, { rating: star })}
                                                                        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                                                                            reviewDraft.rating >= star
                                                                                ? 'border-green-600 bg-green-600 text-white'
                                                                                : 'border-gray-200 bg-white text-gray-300'
                                                                        }`}
                                                                    >
                                                                        <span className="material-icons !text-[18px]">star</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <textarea
                                                                value={reviewDraft.comment}
                                                                onChange={(e) => updateReviewDraft(reviewProductKey, { comment: e.target.value })}
                                                                rows={3}
                                                                placeholder="Share your experience with this product"
                                                                className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition-all focus:border-green-500"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSubmitReview(item)}
                                                                disabled={isSubmittingReview}
                                                                className="mt-3 inline-flex items-center justify-center rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                                                            >
                                                                {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </div>

                        {/* Delivery Address */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="material-icons text-gray-700">location_on</span>
                                Delivery Address
                            </h2>
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <p className="font-bold text-gray-800">{order.shippingAddress.street}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {order.shippingAddress.city}, {order.shippingAddress.postalCode}
                                </p>
                                <p className="text-sm text-gray-600">{order.shippingAddress.country}</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Price Summary */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="material-icons text-gray-700">receipt</span>
                                Price Details
                            </h2>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Items Price</span>
                                    <span className="font-semibold text-gray-900">₹{order.itemsPrice.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Shipping</span>
                                    <span className="font-semibold text-green-600">
                                        {order.shippingPrice > 0 ? `₹${order.shippingPrice}` : 'FREE'}
                                    </span>
                                </div>
                                {Number(order.taxPrice || 0) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Tax</span>
                                        <span className="font-semibold text-gray-900">₹{Number(order.taxPrice).toLocaleString()}</span>
                                    </div>
                                )}
                                {order.coupon?.code && Number(order.coupon?.discount || 0) > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Coupon ({order.coupon.code})</span>
                                        <span className="font-semibold text-green-600">- ₹{Number(order.coupon.discount).toLocaleString()}</span>
                                    </div>
                                )}
                                {order.isCodAdvancedPaid && Number(order.codAdvancedAmount) > 0 && (
                                    <div className="flex justify-between text-sm text-green-600 font-bold">
                                        <span>COD Advance Paid Online</span>
                                        <span>- ₹{Number(order.codAdvancedAmount).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="border-t border-dashed border-gray-300 pt-3 flex justify-between">
                                    <span className="text-base font-bold text-gray-800">
                                        {order.isCodAdvancedPaid ? 'Remaining Amount (COD)' : 'Total Amount'}
                                    </span>
                                    <span className="text-xl font-extrabold text-gray-900">
                                        ₹{(order.isCodAdvancedPaid ? Number(order.remainingCodBalance) : order.totalPrice).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Payment Info */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="material-icons text-gray-700">payment</span>
                                Payment Info
                            </h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Method</span>
                                    <span className="text-sm font-bold text-gray-800">{order.paymentMethod}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600">Status</span>
                                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full border ${paymentInfoStatus === 'Confirmed' || paymentInfoStatus === 'Completed'
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-amber-50 border-amber-200'
                                        }`}>
                                        <span className={`material-icons text-sm ${paymentInfoStatus === 'Confirmed' || paymentInfoStatus === 'Completed' ? 'text-green-600' : 'text-amber-600'}`}>
                                            {paymentInfoStatus === 'Confirmed' || paymentInfoStatus === 'Completed' ? 'check_circle' : 'pending'}
                                        </span>
                                        <span className={`text-xs font-bold ${paymentInfoStatus === 'Confirmed' || paymentInfoStatus === 'Completed' ? 'text-green-700' : 'text-amber-700'}`}>
                                            {paymentInfoStatus}
                                        </span>
                                    </div>
                                </div>
                                {order.paidAt && (
                                    <div className="text-xs text-gray-500 mt-2">
                                        Paid on {new Date(order.paidAt).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric'
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <span className="material-icons text-gray-700">info</span>
                                Order Info
                            </h2>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-600">Order Date</span>
                                    <p className="font-semibold text-gray-800">
                                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                {!isDeliveredOrder && (
                                    <div>
                                        <span className="text-gray-600">Estimated Delivery</span>
                                        <p className={`font-semibold ${deliveryEstimate.isServiceable === false ? 'text-red-600' : 'text-gray-800'}`}>
                                            {deliveryEstimate.text || 'Not available'}
                                        </p>
                                    </div>
                                )}
                                {effectiveDeliveredAt && (
                                    <div>
                                        <span className="text-gray-600">Delivered On</span>
                                        <p className="font-semibold text-green-600">
                                            {formatTrackingDate(effectiveDeliveredAt)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Request Return Button */}
                        {(normalizedOrderStatus === 'Delivered' || order.status === 'Partially Returned') && isWithinReturnWindow && order.orderItems.some((item) => {
                            const itemMeta = itemReturnMetaById[String(item._id)];
                            const remainingQty = itemMeta?.remainingQty ?? Math.max(1, Number(item?.qty || item?.quantity || 1));
                            return remainingQty > 0 && !itemMeta?.hasAnyReturnRequest && isEligibleForNewReturnRequest(item.status);
                        }) && (
                            <button
                                onClick={() => navigate(`/my-orders/${order._id}/return`)}
                                className="w-full bg-white border border-primary-200 text-primary-700 px-6 py-4 rounded-xl font-bold hover:bg-primary-50 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-icons">assignment_return</span>
                                Request Return / Replacement
                            </button>
                        )}

                        {(normalizedOrderStatus === 'Delivered' || order.status === 'Partially Returned') && !isWithinReturnWindow && (
                            <div className="w-full bg-gray-50 border border-gray-200 text-gray-600 px-6 py-4 rounded-xl font-semibold text-sm">
                                Return or replacement is available only within {RETURN_WINDOW_DAYS} days of successful delivery.
                            </div>
                        )}

                        {/* Cancel Order Button */}
                        {normalizedOrderStatus === 'Pending' && (
                            <button
                                onClick={handleCancelOrder}
                                className="w-full bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-icons">cancel</span>
                                Request Cancellation
                            </button>
                        )}

                        {/* Download Invoice Button - visible only after delivery */}
                        {normalizedOrderStatus === 'Delivered' && (
                            <InvoiceGenerator
                                order={order}
                                items={order.orderItems}
                                settings={settings || {}}
                                includeShippingLabel={false}
                                customTrigger={
                                    <button
                                        className="w-full bg-primary-600 text-white px-6 py-4 rounded-xl font-bold hover:bg-primary-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-icons">download</span>
                                        Download Invoice
                                    </button>
                                }
                            />
                        )}

                        {/* Help Button */}
                        <button
                            onClick={() => navigate('/help-center')}
                            className="w-full bg-white border border-gray-300 text-gray-700 px-6 py-4 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-icons">help_outline</span>
                            Need Help?
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetails;

