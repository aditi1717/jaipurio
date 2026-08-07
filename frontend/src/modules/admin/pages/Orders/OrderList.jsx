import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MdLocalShipping, MdCheckCircle, MdPendingActions, MdCancel, MdDownload } from 'react-icons/md';
import toast from 'react-hot-toast';
import API from '../../../../services/api';
import { getAdminPaymentStatus } from '../../utils/paymentStatus';
import OrderListFilters from '../../components/orders/OrderListFilters';
import { DATE_RANGE_PRESETS, resolveDateRange } from '../../components/orders/orderDateRange';
import useNewOrderStore from '../../store/newOrderStore';
import OrderListTable from '../../components/orders/OrderListTable';

const BULK_STATUS_OPTIONS = [
    'Pending',
    'Confirmed',
    'Packed',
    'Dispatched',
    'Out for Delivery',
    'Delivered',
    'Cancelled'
];

const normalizeOrderStatus = (status = '') => {
    const value = String(status || '').trim();
    if (value === 'Shipped') return 'Dispatched';
    return value;
};

const readBlobErrorMessage = async (error) => {
    const responseData = error?.response?.data;
    if (!(responseData instanceof Blob)) {
        return error?.response?.data?.message || '';
    }

    try {
        const text = await responseData.text();
        if (!text) return '';
        const parsed = JSON.parse(text);
        return parsed?.message || text;
    } catch {
        return '';
    }
};

const transformOrder = (order) => {
    const normalizedOrderStatus = normalizeOrderStatus(order?.status);

    return {
        ...order,
        id: order._id,
        date: order.createdAt,
        items: order.orderItems?.map((item) => ({
            id: item.product,
            _id: item._id,
            name: item.name,
            title: item.title,
            productName: item.productName,
            image: item.image,
            price: item.price,
            quantity: item.qty,
            qty: item.qty,
            serialNumber: item.serialNumber,
            serialType: item.serialType || 'Serial Number',
            variant: item.variant
        })) || [],
        total: order.totalPrice,
        payment: {
            method: order.paymentMethod || 'COD',
            status: getAdminPaymentStatus(order)
        },
        status: normalizedOrderStatus || 'Pending',
        baseStatus: normalizedOrderStatus
    };
};

const OrderListLoadingState = ({ message = 'Loading orders...' }) => (
    <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[0, 1, 2].map((card) => (
                <div key={card} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="h-3 w-24 rounded-full bg-gray-200" />
                    <div className="mt-3 h-7 w-20 rounded-full bg-gray-300" />
                    <div className="mt-3 h-3 w-32 rounded-full bg-gray-200" />
                </div>
            ))}
        </div>
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-4 md:px-6">
                <div className="flex gap-3">
                    <div className="h-4 w-10 rounded-full bg-gray-200" />
                    <div className="h-4 w-28 rounded-full bg-gray-200" />
                    <div className="h-4 w-24 rounded-full bg-gray-200" />
                </div>
            </div>
            <div className="space-y-3 px-4 py-4 md:px-6 md:py-5">
                {[0, 1, 2, 3, 4].map((row) => (
                    <div key={row} className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 md:grid-cols-[1.2fr_1fr_1.4fr_0.9fr_0.8fr]">
                        <div className="space-y-2">
                            <div className="h-3 w-28 rounded-full bg-gray-200" />
                            <div className="h-4 w-40 rounded-full bg-gray-300" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 w-20 rounded-full bg-gray-200" />
                            <div className="h-4 w-32 rounded-full bg-gray-300" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 w-24 rounded-full bg-gray-200" />
                            <div className="h-4 w-full rounded-full bg-gray-300" />
                        </div>
                        <div className="h-8 w-24 rounded-full bg-gray-300" />
                        <div className="h-8 w-20 rounded-full bg-gray-200 justify-self-end" />
                    </div>
                ))}
            </div>
        </div>
        <p className="text-center text-sm font-semibold text-gray-500">{message}</p>
    </div>
);

const ORDER_LIST_CACHE_TTL_MS = 2 * 60 * 1000;
const ORDER_LIST_LIVE_SYNC_COOLDOWN_MS = 60 * 1000;
let orderListCache = new Map();

const buildOrderListCacheKey = ({ currentPage, itemsPerPage, searchTerm, statusFilter, userEmailFilter, startDate, endDate }) => (
    JSON.stringify({
        page: currentPage,
        limit: itemsPerPage,
        search: String(searchTerm || '').trim(),
        status: String(statusFilter || 'All').trim(),
        user: String(userEmailFilter || '').trim(),
        startDate: String(startDate || ''),
        endDate: String(endDate || '')
    })
);

const getCachedOrderList = (cacheKey) => {
    const cached = orderListCache.get(cacheKey);
    if (!cached) return null;
    if ((Date.now() - cached.fetchedAt) > ORDER_LIST_CACHE_TTL_MS) {
        orderListCache.delete(cacheKey);
        return null;
    }
    return cached;
};

const OrderList = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const userEmailFilter = searchParams.get('user');

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [dateRange, setDateRange] = useState('all');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const { startDate, endDate } = resolveDateRange(dateRange, customStart, customEnd);
    const itemsPerPage = 20;
    const initialCacheKey = buildOrderListCacheKey({
        currentPage: 1,
        itemsPerPage,
        searchTerm: '',
        statusFilter: 'All',
        userEmailFilter
    });
    const initialCachedOrders = getCachedOrderList(initialCacheKey);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(() => initialCachedOrders?.totalPages || 1);
    const [totalOrders, setTotalOrders] = useState(() => initialCachedOrders?.totalOrders || 0);
    const [localOrders, setLocalOrders] = useState(() => initialCachedOrders?.orders || []);
    const [selectedOrderIds, setSelectedOrderIds] = useState(() => new Set());
    const [bulkStatus, setBulkStatus] = useState('');
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [bulkFulfillmentMode, setBulkFulfillmentMode] = useState('');
    const [isBulkFulfillmentUpdating, setIsBulkFulfillmentUpdating] = useState(false);
    const [showBulkFulfillmentModal, setShowBulkFulfillmentModal] = useState(false);
    const [bulkSerialInputs, setBulkSerialInputs] = useState({});
    const [bulkSerialTypes, setBulkSerialTypes] = useState({});
    const [serialEditorOrderId, setSerialEditorOrderId] = useState('');
    const [serialInputs, setSerialInputs] = useState({});
    const [serialTypes, setSerialTypes] = useState({});
    const [serialSavingOrderId, setSerialSavingOrderId] = useState('');
    const [isLoading, setIsLoading] = useState(() => !initialCachedOrders);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(() => Boolean(initialCachedOrders));
    const [fetchError, setFetchError] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportRange, setExportRange] = useState('30');
    const [exportStart, setExportStart] = useState('');
    const [exportEnd, setExportEnd] = useState('');
    const [exportCurrentPageOnly, setExportCurrentPageOnly] = useState(false);
    const latestRequestRef = useRef(0);
    const liveSyncRunRef = useRef(0);
    const liveSyncCooldownRef = useRef(new Map());
    const [syncingOrderIds, setSyncingOrderIds] = useState(() => new Set());

    useEffect(() => {
        const cacheKey = buildOrderListCacheKey({
            currentPage,
            itemsPerPage,
            searchTerm,
            statusFilter,
            userEmailFilter,
            startDate,
            endDate
        });
        const cachedOrders = getCachedOrderList(cacheKey);

        if (cachedOrders) {
            setLocalOrders(cachedOrders.orders);
            setTotalPages(cachedOrders.totalPages);
            setTotalOrders(cachedOrders.totalOrders);
            setHasLoadedOnce(true);
            setIsLoading(false);
        }

        const fetchPaginatedOrders = async () => {
            const requestId = latestRequestRef.current + 1;
            latestRequestRef.current = requestId;
            setIsLoading(!cachedOrders);
            setFetchError('');

            try {
                const params = {
                    pageNumber: currentPage,
                    limit: itemsPerPage,
                    syncPayments: false,
                    // Keep the list view fast; live courier sync belongs on detail actions.
                    syncFulfillment: false,
                    includePaymentAudit: false
                };

                if (searchTerm) params.search = searchTerm;
                if (statusFilter !== 'All') params.status = statusFilter;
                if (userEmailFilter) params.user = userEmailFilter;
                if (startDate) params.startDate = startDate;
                if (endDate) params.endDate = endDate;

                const { data } = await API.get('/orders', { params });
                if (requestId !== latestRequestRef.current) return;

                let nextOrders = [];
                let nextTotalPages = 1;
                let nextTotalOrders = 0;

                if (data.orders) {
                    nextOrders = data.orders.map((order) => transformOrder(order));
                    nextTotalPages = data.pages || 1;
                    nextTotalOrders = Number(data.total) || 0;
                } else {
                    nextOrders = Array.isArray(data) ? data.map((order) => transformOrder(order)) : [];
                    nextTotalPages = 1;
                    nextTotalOrders = Array.isArray(data) ? data.length : 0;
                }

                orderListCache.set(cacheKey, {
                    orders: nextOrders,
                    totalPages: nextTotalPages,
                    totalOrders: nextTotalOrders,
                    fetchedAt: Date.now()
                });

                setLocalOrders(nextOrders);
                setTotalPages(nextTotalPages);
                setTotalOrders(nextTotalOrders);
                setHasLoadedOnce(true);
            } catch (error) {
                console.error(error);
                if (requestId !== latestRequestRef.current) return;
                const message = error.response?.data?.message || 'Failed to load orders';
                setFetchError(message);
                toast.error(message);
            } finally {
                if (requestId === latestRequestRef.current) {
                    setIsLoading(false);
                }
            }
        };

        const timer = setTimeout(fetchPaginatedOrders, cachedOrders ? 0 : 300);
        return () => clearTimeout(timer);
    }, [currentPage, searchTerm, statusFilter, userEmailFilter, startDate, endDate]);

    // Opening the list is the "read" action that clears the sidebar badge.
    useEffect(() => {
        useNewOrderStore.getState().markSeen();
    }, []);

    useEffect(() => {
        setSelectedOrderIds(new Set());
        setSerialEditorOrderId('');
        setSerialInputs({});
        setSerialTypes({});
    }, [currentPage, searchTerm, statusFilter, userEmailFilter, startDate, endDate]);

    useEffect(() => {
        if (!localOrders.length || isLoading || fetchError) {
            setSyncingOrderIds(new Set());
            return undefined;
        }

        const cacheKey = buildOrderListCacheKey({
            currentPage,
            itemsPerPage,
            searchTerm,
            statusFilter,
            userEmailFilter,
            startDate,
            endDate
        });
        const lastSyncedAt = liveSyncCooldownRef.current.get(cacheKey);
        if (lastSyncedAt && (Date.now() - lastSyncedAt) < ORDER_LIST_LIVE_SYNC_COOLDOWN_MS) {
            setSyncingOrderIds(new Set());
            return undefined;
        }

        const eligibleOrders = localOrders.filter((order) => {
            const mode = String(order.fulfillment?.mode || '').trim().toLowerCase();
            const hasTrackingId = Boolean(order.delhivery?.waybill || order.ekart?.trackingNumber);
            return ['delhivery', 'ekart'].includes(mode)
                && hasTrackingId
                && !['Delivered', 'Cancelled'].includes(order.status);
        });

        if (!eligibleOrders.length) {
            setSyncingOrderIds(new Set());
            return undefined;
        }

        const syncRunId = liveSyncRunRef.current + 1;
        liveSyncRunRef.current = syncRunId;
        liveSyncCooldownRef.current.set(cacheKey, Date.now());
        const eligibleOrderIds = new Set(eligibleOrders.map((order) => order.id));
        setSyncingOrderIds(eligibleOrderIds);

        const updateOrderCacheEntry = (orderId, updatedOrder) => {
            const cachedEntry = orderListCache.get(cacheKey);
            if (!cachedEntry) return;

            orderListCache.set(cacheKey, {
                ...cachedEntry,
                orders: cachedEntry.orders.map((entry) => (
                    entry.id === orderId ? updatedOrder : entry
                ))
            });
        };

        const syncOrder = async (order) => {
            try {
                const { data } = await API.get(`/orders/${order.id}`, {
                    params: {
                        ensureInvoice: false,
                        syncPayment: false,
                        syncFulfillment: true,
                        includePaymentAudit: false
                    }
                });

                if (liveSyncRunRef.current !== syncRunId) return;

                const transformedOrder = transformOrder(data);
                setLocalOrders((orders) => orders.map((entry) => (
                    entry.id === order.id ? transformedOrder : entry
                )));
                updateOrderCacheEntry(order.id, transformedOrder);
            } catch (error) {
                console.error(`Failed to sync live tracking for order ${order.id}:`, error);
            } finally {
                if (liveSyncRunRef.current !== syncRunId) return;
                setSyncingOrderIds((prev) => {
                    const next = new Set(prev);
                    next.delete(order.id);
                    return next;
                });
            }
        };

        const runSyncQueue = async () => {
            const concurrency = 3;
            for (let index = 0; index < eligibleOrders.length; index += concurrency) {
                const batch = eligibleOrders.slice(index, index + concurrency);
                await Promise.all(batch.map(syncOrder));
                if (liveSyncRunRef.current !== syncRunId) return;
            }
        };

        runSyncQueue();

        return () => {
            if (liveSyncRunRef.current === syncRunId) {
                liveSyncRunRef.current += 1;
            }
        };
    }, [localOrders, isLoading, fetchError, currentPage, itemsPerPage, searchTerm, statusFilter, userEmailFilter, startDate, endDate]);

    const filteredOrders = localOrders;
    const selectedCount = selectedOrderIds.size;
    const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selectedOrderIds.has(order.id));
    const someVisibleSelected = filteredOrders.some((order) => selectedOrderIds.has(order.id));
    const isLiveSyncing = syncingOrderIds.size > 0;

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Pending': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'Confirmed': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'Packed': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'Manifested': return 'bg-cyan-50 text-cyan-600 border-cyan-100';
            case 'Not Picked': return 'bg-sky-50 text-sky-600 border-sky-100';
            case 'Scheduled': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'Dispatched': return 'bg-purple-50 text-purple-600 border-purple-100';
            case 'In Transit': return 'bg-violet-50 text-violet-600 border-violet-100';
            case 'Out for Delivery': return 'bg-orange-50 text-orange-600 border-orange-100';
            case 'Delivered': return 'bg-green-50 text-green-600 border-green-100';
            case 'Cancelled': return 'bg-red-50 text-red-600 border-red-100';
            default: return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'Pending': return <MdPendingActions size={14} />;
            case 'Confirmed': return <MdCheckCircle size={14} />;
            case 'Packed': return <MdPendingActions size={14} />;
            case 'Manifested': return <MdLocalShipping size={14} />;
            case 'Not Picked': return <MdPendingActions size={14} />;
            case 'Scheduled': return <MdPendingActions size={14} />;
            case 'Dispatched': return <MdLocalShipping size={14} />;
            case 'In Transit': return <MdLocalShipping size={14} />;
            case 'Out for Delivery': return <MdLocalShipping size={14} />;
            case 'Delivered': return <MdCheckCircle size={14} />;
            case 'Cancelled': return <MdCancel size={14} />;
            default: return null;
        }
    };

    const resetSerialEditor = () => {
        setSerialEditorOrderId('');
        setSerialInputs({});
        setSerialTypes({});
    };

    const handleOpenSerialEditor = (order) => {
        if (serialEditorOrderId === order.id) {
            resetSerialEditor();
            return;
        }

        const nextInputs = {};
        const nextTypes = {};

        (order.items || []).forEach((item) => {
            if (item.serialNumber) nextInputs[item._id] = item.serialNumber;
            if (item.serialType) nextTypes[item._id] = item.serialType;
        });

        setSerialInputs(nextInputs);
        setSerialTypes(nextTypes);
        setSerialEditorOrderId(order.id);
    };

    const handleSerialSave = async (order) => {
        const serialNumbers = (order.items || []).map((item) => ({
            itemId: item._id,
            serial: (serialInputs[item._id] !== undefined ? serialInputs[item._id] : item.serialNumber || '').trim(),
            type: serialTypes[item._id] !== undefined ? serialTypes[item._id] : (item.serialType || 'Serial Number')
        })).filter((item) => item.serial);

        if (!serialNumbers.length) {
            toast.error('Enter at least one Serial Number or IMEI before saving.');
            return;
        }

        setSerialSavingOrderId(order.id);
        try {
            const { data } = await API.put(`/orders/${order.id}/status`, {
                status: order.baseStatus || order.status,
                serialNumbers
            });

            setLocalOrders((orders) => orders.map((entry) => (
                entry.id === order.id ? transformOrder(data) : entry
            )));
            toast.success('Serial / IMEI saved successfully');
            resetSerialEditor();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save Serial / IMEI');
        } finally {
            setSerialSavingOrderId('');
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleToggleOrder = (orderId) => {
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    const handleToggleVisibleOrders = () => {
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) {
                filteredOrders.forEach((order) => next.delete(order.id));
            } else {
                filteredOrders.forEach((order) => next.add(order.id));
            }
            return next;
        });
    };

    const handleBulkStatusUpdate = async () => {
        if (!selectedCount) {
            toast.error('Select at least one order');
            return;
        }

        if (!bulkStatus) {
            toast.error('Choose a status first');
            return;
        }

        setIsBulkUpdating(true);
        try {
            const { data } = await API.put('/orders/bulk-status', {
                orderIds: Array.from(selectedOrderIds),
                status: bulkStatus
            });

            const updatedOrderById = new Map((data.updatedOrders || []).map((order) => [order._id, order]));

            setLocalOrders((orders) => orders.map((order) => {
                const updatedOrder = updatedOrderById.get(order.id);
                return updatedOrder ? transformOrder(updatedOrder) : order;
            }));
            setSelectedOrderIds(new Set());
            setBulkStatus('');

            const updatedCount = data.updatedOrders?.length || 0;
            const failedCount = data.failedOrders?.length || 0;
            if (updatedCount) {
                toast.success(`${updatedCount} order${updatedCount === 1 ? '' : 's'} updated to ${bulkStatus}`);
            }
            if (failedCount) {
                toast.error(`${failedCount} order${failedCount === 1 ? '' : 's'} could not be updated`);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update selected orders');
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleBulkFulfillmentClick = () => {
        if (!selectedOrderIds.size) {
            toast.error('Select at least one order');
            return;
        }
        if (!bulkFulfillmentMode) {
            toast.error('Choose a fulfillment mode first');
            return;
        }

        // Initialize bulk serial inputs for selected orders
        const nextInputs = {};
        const nextTypes = {};
        const selectedOrdersList = localOrders.filter((o) => selectedOrderIds.has(o.id));

        selectedOrdersList.forEach((order) => {
            (order.items || []).forEach((item) => {
                nextInputs[`${order.id}_${item._id}`] = item.serialNumber || '';
                nextTypes[`${order.id}_${item._id}`] = item.serialType || 'Serial Number';
            });
        });

        setBulkSerialInputs(nextInputs);
        setBulkSerialTypes(nextTypes);
        setShowBulkFulfillmentModal(true);
    };

    const handleBulkFulfillmentSubmit = async () => {
        setIsBulkFulfillmentUpdating(true);
        const selectedOrdersList = localOrders.filter((o) => selectedOrderIds.has(o.id));
        const successes = [];
        const failures = [];
        const updatedOrdersMap = new Map();

        for (const order of selectedOrdersList) {
            try {
                // 1. Build and save serial numbers/IMEIs for this order
                const serialNumbers = (order.items || []).map((item) => {
                    const serialVal = (bulkSerialInputs[`${order.id}_${item._id}`] || '').trim();
                    const typeVal = bulkSerialTypes[`${order.id}_${item._id}`] || 'Serial Number';
                    return {
                        itemId: item._id,
                        serial: serialVal,
                        type: typeVal
                    };
                }).filter((s) => s.serial);

                if (serialNumbers.length > 0) {
                    await API.put(`/orders/${order.id}/status`, {
                        status: order.baseStatus || order.status,
                        serialNumbers
                    });
                }

                // 2. Assign fulfillment mode
                const { data } = await API.put(`/orders/${order.id}/fulfillment`, { mode: bulkFulfillmentMode });
                successes.push(order.displayId || order.id);
                updatedOrdersMap.set(order.id, transformOrder(data));
            } catch (error) {
                const errMsg = error.response?.data?.message || error.message || 'Fulfillment assignment failed';
                failures.push({
                    displayId: order.displayId || order.id,
                    error: errMsg
                });
            }
        }

        // Update local orders state
        if (successes.length > 0) {
            setLocalOrders((prevOrders) =>
                prevOrders.map((o) => (updatedOrdersMap.has(o.id) ? updatedOrdersMap.get(o.id) : o))
            );
        }

        // Show feedback to user
        if (successes.length > 0) {
            toast.success(`Successfully assigned ${bulkFulfillmentMode} for: ${successes.join(', ')}`);
        }
        if (failures.length > 0) {
            failures.forEach((f) => {
                toast.error(`Order ${f.displayId}: ${f.error}`);
            });
        }

        // Clear and close
        setSelectedOrderIds(new Set());
        setBulkFulfillmentMode('');
        setShowBulkFulfillmentModal(false);
        setIsBulkFulfillmentUpdating(false);
    };

    const handleExportOrders = async () => {
        const range = resolveDateRange(exportRange, exportStart, exportEnd);
        if (exportRange === 'custom' && (!range.startDate || !range.endDate)) {
            toast.error('Pick both a start and end date');
            return;
        }

        setIsExporting(true);
        try {
            const params = {};
            if (searchTerm) params.search = searchTerm;
            if (statusFilter !== 'All') params.status = statusFilter;
            if (userEmailFilter) params.user = userEmailFilter;
            if (range.startDate) params.startDate = range.startDate;
            if (range.endDate) params.endDate = range.endDate;
            if (exportCurrentPageOnly) {
                params.pageNumber = currentPage;
                params.limit = itemsPerPage;
            }

            const { data } = await API.get('/orders/export', {
                params,
                responseType: 'blob',
                timeout: 0
            });

            const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `orders_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setShowExportModal(false);
            toast.success('Orders exported');
        } catch (error) {
            const serverMessage = await readBlobErrorMessage(error);
            const errorMessage = error.code === 'ECONNABORTED'
                ? 'Orders export timed out'
                : 'Failed to export orders';
            toast.error(serverMessage || errorMessage);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-3 md:space-y-4 px-2 md:px-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                <div>
                    <h1 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight">Order Management</h1>
                    <p className="text-xs md:text-sm text-gray-500 font-medium italic">Monitor sales and live fulfillment progress ({totalOrders} total)</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowExportModal(true)}
                    disabled={isExporting}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                    <MdDownload size={18} />
                    {isExporting ? 'Exporting...' : 'Export Orders'}
                </button>
            </div>

            <OrderListFilters
                searchTerm={searchTerm}
                statusFilter={statusFilter}
                onSearchChange={(value) => {
                    setSearchTerm(value);
                    setCurrentPage(1);
                }}
                onStatusChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                }}
                dateRange={dateRange}
                customStart={customStart}
                customEnd={customEnd}
                onDateRangeChange={(value) => {
                    setDateRange(value);
                    setCurrentPage(1);
                }}
                onCustomRangeChange={(start, end) => {
                    setCustomStart(start);
                    setCustomEnd(end);
                    setCurrentPage(1);
                }}
            />

            {isLoading && !hasLoadedOnce ? (
                <OrderListLoadingState />
            ) : fetchError && filteredOrders.length === 0 ? (
                <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-10 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-red-500 shadow-sm">
                        <MdCancel size={28} />
                    </div>
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-red-500">Could not load orders</p>
                    <p className="mt-2 text-sm font-medium text-red-700">{fetchError}</p>
                </div>
            ) : (
                <>
            {selectedCount > 0 && (
                <div className="bg-gray-950 text-white p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-800 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-tight">{selectedCount} selected</p>
                        <p className="text-[10px] text-gray-300 font-bold">Bulk status updates or fulfillment updates will be applied to the selected orders.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-center">
                        <select
                            className="px-4 py-2 bg-white text-gray-900 border border-gray-700 rounded-lg outline-none text-xs font-black cursor-pointer"
                            value={bulkStatus}
                            onChange={(e) => setBulkStatus(e.target.value)}
                            disabled={isBulkUpdating || isBulkFulfillmentUpdating}
                        >
                            <option value="">Choose status</option>
                            {BULK_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={handleBulkStatusUpdate}
                            disabled={isBulkUpdating || !bulkStatus || isBulkFulfillmentUpdating}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-black transition-colors"
                        >
                            {isBulkUpdating ? 'Updating...' : 'Update Selected'}
                        </button>

                        <div className="hidden sm:block h-6 w-px bg-gray-800 mx-1" />

                        <select
                            className="px-4 py-2 bg-white text-gray-900 border border-gray-700 rounded-lg outline-none text-xs font-black cursor-pointer"
                            value={bulkFulfillmentMode}
                            onChange={(e) => setBulkFulfillmentMode(e.target.value)}
                            disabled={isBulkUpdating || isBulkFulfillmentUpdating}
                        >
                            <option value="">Choose fulfillment</option>
                            <option value="manual">Manual Delivery</option>
                            <option value="ekart">Ekart</option>
                            <option value="delhivery">Delhivery</option>
                        </select>
                        <button
                            type="button"
                            onClick={handleBulkFulfillmentClick}
                            disabled={isBulkFulfillmentUpdating || isBulkUpdating || !bulkFulfillmentMode}
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-black transition-colors"
                        >
                            {isBulkFulfillmentUpdating ? 'Assigning...' : 'Assign Fulfillment'}
                        </button>
                    </div>
                </div>
            )}

            {filteredOrders.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <MdLocalShipping size={32} />
                    </div>
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">No orders found matching your criteria</p>
                </div>
            ) : (
                <OrderListTable
                    orders={filteredOrders}
                    totalPages={totalPages}
                    currentPage={currentPage}
                    onPageChange={handlePageChange}
                    allVisibleSelected={allVisibleSelected}
                    someVisibleSelected={someVisibleSelected}
                    selectedOrderIds={selectedOrderIds}
                    onToggleVisibleOrders={handleToggleVisibleOrders}
                    onToggleOrder={handleToggleOrder}
                    getStatusStyle={getStatusStyle}
                    getStatusIcon={getStatusIcon}
                    syncingOrderIds={syncingOrderIds}
                    serialEditorOrderId={serialEditorOrderId}
                    onOpenSerialEditor={handleOpenSerialEditor}
                    onResetSerialEditor={resetSerialEditor}
                    onSaveSerial={handleSerialSave}
                    serialInputs={serialInputs}
                    serialTypes={serialTypes}
                    setSerialInputs={setSerialInputs}
                    setSerialTypes={setSerialTypes}
                    serialSavingOrderId={serialSavingOrderId}
                    navigate={navigate}
                    isRefreshing={isLoading}
                    isLiveSyncing={isLiveSyncing}
                />
            )}
                </>
            )}

            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl bg-white border border-gray-100 shadow-2xl p-6 space-y-4">
                        <div>
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-wide">Export Orders</h2>
                            <p className="text-xs font-bold text-gray-500 mt-1">Choose the date range to include. One row per product, with variant, serial and IMEI columns.</p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Date Range</label>
                            <select
                                value={exportRange}
                                onChange={(e) => setExportRange(e.target.value)}
                                disabled={isExporting}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white"
                            >
                                {DATE_RANGE_PRESETS.map((preset) => (
                                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                                ))}
                            </select>
                        </div>

                        {exportRange === 'custom' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">From</label>
                                    <input
                                        type="date"
                                        value={exportStart}
                                        max={exportEnd || undefined}
                                        onChange={(e) => setExportStart(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">To</label>
                                    <input
                                        type="date"
                                        value={exportEnd}
                                        min={exportStart || undefined}
                                        onChange={(e) => setExportEnd(e.target.value)}
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                            </div>
                        )}

                        <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                            <input
                                type="checkbox"
                                checked={exportCurrentPageOnly}
                                onChange={(e) => setExportCurrentPageOnly(e.target.checked)}
                            />
                            Only export the current page ({itemsPerPage} orders)
                        </label>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                disabled={isExporting}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleExportOrders}
                                disabled={isExporting}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase hover:bg-emerald-700 disabled:bg-emerald-300"
                            >
                                {isExporting ? 'Exporting...' : 'Download CSV'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showBulkFulfillmentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-sm overflow-y-auto">
                    <div className="relative w-full max-w-3xl rounded-3xl bg-white border border-gray-100 shadow-2xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-gray-150 pb-4 mb-4">
                            <div>
                                <h2 className="text-lg font-black text-gray-900 uppercase tracking-wide">
                                    Save Product IMEIs & Assign Fulfillment
                                </h2>
                                <p className="text-xs font-bold text-gray-500 mt-1 uppercase">
                                    Assigning {selectedOrderIds.size} order(s) to: <span className="text-indigo-600 font-black">{bulkFulfillmentMode === 'manual' ? 'Manual Delivery' : bulkFulfillmentMode}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBulkFulfillmentModal(false);
                                    setBulkFulfillmentMode('');
                                }}
                                disabled={isBulkFulfillmentUpdating}
                                className="text-gray-400 hover:text-gray-600 font-black text-lg p-1"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body - Scrollable list of orders */}
                        <div className="flex-1 overflow-y-auto min-h-0 pr-2 space-y-6 custom-scrollbar">
                            {localOrders
                                .filter((order) => selectedOrderIds.has(order.id))
                                .map((order) => (
                                    <div key={order.id} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                            <span className="text-xs font-black text-gray-900">{order.displayId || order.id}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                                                {order.user?.name || order.shippingAddress?.name || 'Unknown User'}
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            {(order.items || []).map((item, idx) => {
                                                const inputKey = `${order.id}_${item._id}`;
                                                return (
                                                    <div key={item._id || idx} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_160px_minmax(0,1fr)] gap-3 bg-white p-3 rounded-xl border border-gray-150/80 shadow-sm items-center">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <img
                                                                src={item.image}
                                                                alt={item.name}
                                                                className="h-10 w-10 rounded object-cover flex-shrink-0 border border-gray-100"
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black text-gray-900 truncate">{item.name}</p>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">Qty: {item.quantity}</p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-black text-gray-400 uppercase mb-0.5">Type</label>
                                                            <select
                                                                value={bulkSerialTypes[inputKey] || 'Serial Number'}
                                                                onChange={(e) => setBulkSerialTypes(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                                disabled={isBulkFulfillmentUpdating}
                                                                className="w-full rounded-lg border border-gray-250 bg-gray-50 px-2 py-1 text-xs font-bold text-gray-900 outline-none focus:border-indigo-400 focus:bg-white"
                                                            >
                                                                <option value="Serial Number">Serial Number</option>
                                                                <option value="IMEI">IMEI</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-black text-gray-400 uppercase mb-0.5">Number</label>
                                                            <input
                                                                type="text"
                                                                value={bulkSerialInputs[inputKey] !== undefined ? bulkSerialInputs[inputKey] : ''}
                                                                onChange={(e) => setBulkSerialInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                                disabled={isBulkFulfillmentUpdating}
                                                                placeholder="Enter serial or IMEI"
                                                                className="w-full rounded-lg border border-gray-250 bg-gray-50 px-2 py-1 text-xs font-mono text-gray-900 outline-none focus:border-indigo-400 focus:bg-white"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t border-gray-150 pt-4 mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBulkFulfillmentModal(false);
                                    setBulkFulfillmentMode('');
                                }}
                                disabled={isBulkFulfillmentUpdating}
                                className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-black uppercase hover:bg-gray-50 disabled:opacity-60 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkFulfillmentSubmit}
                                disabled={isBulkFulfillmentUpdating}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors flex items-center justify-center gap-2"
                            >
                                {isBulkFulfillmentUpdating && <div className="h-3 w-3 rounded-full border border-white/30 border-t-white animate-spin" />}
                                {isBulkFulfillmentUpdating ? 'Processing...' : `Confirm & Assign ${bulkFulfillmentMode}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrderList;
