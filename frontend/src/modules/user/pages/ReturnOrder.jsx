import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import API from '../../../services/api';
import { toast } from 'react-hot-toast';

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

const normalizeVariant = (value) => (value && typeof value === 'object' ? value : {});
const isSameVariant = (first = {}, second = {}) => JSON.stringify(first || {}) === JSON.stringify(second || {});

const doesReturnMatchItem = (ret, item) => {
    if (!ret || !item) return false;

    if (ret.orderItemId) {
        return String(ret.orderItemId) === String(item.orderItemId || item.id);
    }

    const sameProductId = ret?.product?.id !== undefined && String(ret.product.id) === String(item.productId);
    const sameVariant = isSameVariant(normalizeVariant(ret?.product?.variant), normalizeVariant(item.variant));
    const sameName = String(ret?.product?.name || '').trim() === String(item?.name || '').trim();

    return (sameProductId && sameVariant) || (sameName && sameVariant);
};

const ReturnOrder = () => {
    const { orderId, productId, action } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    // const orders = useCartStore(state => state.orders); // Removed dependency on store orders
    const [order, setOrder] = useState(null);
    const [loadingOrder, setLoadingOrder] = useState(true);
    const [myReturns, setMyReturns] = useState([]);

    // Flow state: 0: Item selection, 3: Resolution first, 1: Reason, 2: Sub-reason, 4: Details/Submit
    const [step, setStep] = useState(0);
    const [reason, setReason] = useState('');
    const [selectedReplacementSize, setSelectedReplacementSize] = useState('');
    const [selectedReplacementColor, setSelectedReplacementColor] = useState('');
    const [replacementProduct, setReplacementProduct] = useState(null);
    const [subReason, setSubReason] = useState('');
    const [comment, setComment] = useState('');
    const [bankDetails, setBankDetails] = useState({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: ''
    });
    const [googleDriveLink, setGoogleDriveLink] = useState('');
    const [proofFiles, setProofFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const addresses = useCartStore((state) => state.addresses || []);
    const [showAddressSelector, setShowAddressSelector] = useState(false);
    const [selectedPickupAddressId, setSelectedPickupAddressId] = useState(null);
    const [selectedPickupAddress, setSelectedPickupAddress] = useState(null);
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [selectedItemQuantities, setSelectedItemQuantities] = useState({});
    const ACCOUNT_NUMBER_REGEX = /^\d{9,18}$/;
    const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    const formatAccountNumber = (value = '') => String(value).replace(/\D/g, '').slice(0, 18).replace(/(.{4})/g, '$1 ').trim();
    const normalizedAction = String(action || '').toLowerCase();
    const returnMode = normalizedAction === 'replace' ? 'REPLACEMENT' : 'REFUND';
    const modePath = useMemo(() => {
        const base = `/my-orders/${orderId}`;
        const suffix = productId ? `/${productId}` : '';
        return {
            REFUND: `${base}/return${suffix}`,
            REPLACEMENT: `${base}/replace${suffix}`
        };
    }, [orderId, productId]);

    const switchReturnMode = (mode) => {
        const targetPath = modePath[mode];
        if (targetPath && location.pathname !== targetPath) {
            navigate(targetPath, { replace: true });
        }
    };

    useEffect(() => {
        if (!['return', 'replace'].includes(normalizedAction)) {
            navigate(modePath.REFUND, { replace: true });
        }
    }, [normalizedAction, navigate, modePath]);

    useEffect(() => {
        const fetchMyReturns = async () => {
            try {
                const { data } = await API.get('/returns/my-returns');
                setMyReturns(Array.isArray(data) ? data : []);
            } catch (error) {
                setMyReturns([]);
            }
        };
        fetchMyReturns();
    }, []);

    useEffect(() => {
        const fetchOrder = async () => {
            try {
                const { data } = await API.get(`/orders/${orderId}`);
                // Normalize items to match expected structure if needed, or just use orderItems
                // The component below uses 'items', let's map orderItems to items for compatibility
                // or update the component to use orderItems. 
                // Updating component to use orderItems is cleaner but 'items' is used in logic.
                // Let's normalize here.
                const normalizedOrder = {
                    ...data,
                    id: data._id, 
                    items: data.orderItems.map(item => ({
                        ...item,
                        id: item._id,
                        orderItemId: item._id,
                        productId: item.product,
                        quantity: item.qty ?? item.quantity ?? 1
                    }))
                };
                setOrder(normalizedOrder);
            } catch (error) {
                console.error("Failed to fetch order", error);
            } finally {
                setLoadingOrder(false);
            }
        };
        fetchOrder();
    }, [orderId]);

    useEffect(() => {
        if (!order) return;

        if (addresses.length > 0) {
            const primary = addresses[0];
            setSelectedPickupAddressId(primary.id);
            setSelectedPickupAddress({
                name: primary.name || order.shippingAddress?.name || '',
                phone: primary.mobile || primary.phone || order.shippingAddress?.phone || '',
                address: primary.address || order.shippingAddress?.street || '',
                city: primary.city || order.shippingAddress?.city || '',
                state: primary.state || order.shippingAddress?.state || '',
                pincode: primary.pincode || order.shippingAddress?.postalCode || '',
                type: primary.type || 'Home'
            });
            return;
        }

        setSelectedPickupAddressId('order-shipping');
        setSelectedPickupAddress({
            name: order.shippingAddress?.name || '',
            phone: order.shippingAddress?.phone || '',
            address: order.shippingAddress?.street || '',
            city: order.shippingAddress?.city || '',
            state: order.shippingAddress?.state || '',
            pincode: order.shippingAddress?.postalCode || '',
            type: 'Home'
        });
    }, [order, addresses]);

    const handleSelectPickupAddress = (address) => {
        setSelectedPickupAddressId(address.id);
        setSelectedPickupAddress({
            name: address.name || '',
            phone: address.mobile || address.phone || '',
            address: address.address || '',
            city: address.city || '',
            state: address.state || '',
            pincode: address.pincode || '',
            type: address.type || 'Home'
        });
        setShowAddressSelector(false);
    };

    const handleSelectOrderShippingAddress = () => {
        setSelectedPickupAddressId('order-shipping');
        setSelectedPickupAddress({
            name: order?.shippingAddress?.name || '',
            phone: order?.shippingAddress?.phone || '',
            address: order?.shippingAddress?.street || '',
            city: order?.shippingAddress?.city || '',
            state: order?.shippingAddress?.state || '',
            pincode: order?.shippingAddress?.postalCode || '',
            type: 'Order Address'
        });
        setShowAddressSelector(false);
    };

    const handleItemSelectionChange = (itemId, checked) => {
        const normalizedId = String(itemId);
        setSelectedItemIds((prev) => {
            const current = Array.isArray(prev) ? prev.map((id) => String(id)) : [];
            if (checked) {
                if (current.includes(normalizedId)) return current;
                return [...current, normalizedId];
            }
            return current.filter((id) => id !== normalizedId);
        });
    };

    const reasons = [
        {
            title: "Quality of the product not as expected",
            subs: ["Item is used", "Duplicate product", "Poor quality", "Defect in product"]
        },
        {
            title: "Received a broken/damaged item",
            subs: ["Item damaged during delivery", "Packaging was torn", "Item arrived broken"]
        },
        {
            title: "Wrong item was sent",
            subs: ["Different product received", "Wrong color/size sent", "Item missing from box"]
        },
        {
            title: "Size/Fit issue",
            subs: ["Item is too large", "Item is too small", "Fit is not comfortable"]
        },
        {
            title: "Don't want the product anymore",
            subs: ["Better price available elsewhere", "No longer needed", "Mistakenly ordered"]
        }
    ];

    const isEligibleForReturn = (itemStatus, availableQuantity = 0) => {
        if (availableQuantity > 0) return true;
        if (!itemStatus) return false;
        const normalized = String(itemStatus).trim().toLowerCase();
        if (normalized === 'delivered') return availableQuantity > 0;

        const blocked = [
            'return requested',
            'replacement requested',
            'approved',
            'pickup scheduled',
            'received at warehouse',
            'refund initiated',
            'replacement dispatched',
            'returned',
            'replaced',
            'completed',
            'cancelled',
            'rejected',
            'return rejected'
        ];
        return !blocked.includes(normalized) && availableQuantity > 0;
    };

    const isWithinReturnWindow = useMemo(() => {
        const deliveredAt = order?.deliveredAt ? new Date(order.deliveredAt) : null;
        if (!deliveredAt || Number.isNaN(deliveredAt.getTime())) return false;

        const diffMs = Date.now() - deliveredAt.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays <= RETURN_WINDOW_DAYS;
    }, [order?.deliveredAt]);

    const itemReturnMetaById = useMemo(() => {
        const orderKey = String(order?.id || order?._id || '');
        const items = Array.isArray(order?.items) ? order.items : [];

        return items.reduce((acc, item) => {
            const orderedQty = Math.max(1, Number(item.quantity || 1));
            const matchingReturns = myReturns.filter((ret) =>
                String(ret?.orderId || '') === orderKey &&
                String(ret?.type || '') !== 'Cancellation' &&
                doesReturnMatchItem(ret, item)
            );

            let consumedQty = 0;
            let rejectedQty = 0;
            let latestRejectedReason = '';
            let hasAnyReturnRequest = false;

            matchingReturns.forEach((ret) => {
                const requestQty = Math.max(1, Number(ret?.requestedQuantity || 1));
                const normalizedStatus = String(ret?.status || '').trim();

                if (RETURN_LOCKING_STATUSES.has(normalizedStatus)) {
                    hasAnyReturnRequest = true;
                }

                if (normalizedStatus === 'Rejected') {
                    rejectedQty += requestQty;
                    const timeline = Array.isArray(ret?.timeline) ? ret.timeline : [];
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

            acc[String(item.id)] = {
                orderedQty,
                consumedQty,
                rejectedQty,
                hasAnyReturnRequest,
                remainingQty: Math.max(0, orderedQty - consumedQty),
                latestRejectedReason
            };
            return acc;
        }, {});
    }, [myReturns, order]);

    const targetItems = useMemo(() => {
        if (!order?.items) return [];
        if (!isWithinReturnWindow) return [];
        const itemsToCheck = productId
            ? order.items.filter((item) => String(item.id) === String(productId) || String(item.productId) === String(productId))
            : order.items;
        return itemsToCheck
            .map((item) => ({
                ...item,
                returnMeta: itemReturnMetaById[String(item.id)] || {
                    orderedQty: Math.max(1, Number(item.quantity || 1)),
                    consumedQty: 0,
                    rejectedQty: 0,
                    hasAnyReturnRequest: false,
                    remainingQty: Math.max(1, Number(item.quantity || 1)),
                    latestRejectedReason: ''
                },
                returnableQuantity: itemReturnMetaById[String(item.id)]?.remainingQty ?? Math.max(1, Number(item.quantity || 1))
            }))
            .filter((item) => !item.returnMeta?.hasAnyReturnRequest)
            .filter((item) => isEligibleForReturn(item.status, item.returnableQuantity));
    }, [order, productId, isWithinReturnWindow, itemReturnMetaById]);

    useEffect(() => {
        const targetIds = targetItems.map((item) => String(item.id));
        setSelectedItemIds((prev) => {
            if (productId) return targetIds;
            if (!prev || prev.length === 0) return [];
            const filtered = prev.filter((id) => targetIds.includes(String(id)));
            return filtered;
        });
    }, [targetItems, productId]);

    useEffect(() => {
        setSelectedItemQuantities((prev) => {
            const next = {};
            targetItems.forEach((item) => {
                const itemKey = String(item.id);
                const maxQty = Math.max(1, Number(item.returnableQuantity || item.quantity || 1));
                next[itemKey] = Math.min(Math.max(1, Number(prev[itemKey] || 1)), maxQty);
            });
            return next;
        });
    }, [targetItems]);

    useEffect(() => {
        setReason('');
        setSubReason('');
        setComment('');
        setProofFiles([]);
        setGoogleDriveLink('');
        setBankDetails({
            accountHolderName: '',
            accountNumber: '',
            ifscCode: ''
        });

        if (productId) {
            setStep(3);
            return;
        }

        if (targetItems.length > 0) {
            setStep(0);
            return;
        }
    }, [orderId, action, productId, targetItems.length]);

    useEffect(() => {
        if (productId) {
            setStep(3);
        }
    }, [productId]);

    const handleSelectedQuantityChange = (itemId, nextQuantity, maxQuantity) => {
        const normalizedId = String(itemId);
        setSelectedItemQuantities((prev) => ({
            ...prev,
            [normalizedId]: Math.min(Math.max(1, nextQuantity), Math.max(1, maxQuantity))
        }));
    };

    const selectedItems = useMemo(
        () => targetItems.filter((item) => selectedItemIds.includes(String(item.id))),
        [targetItems, selectedItemIds]
    );

    const replacementItem = selectedItems[0] || null;

    useEffect(() => {
        let cancelled = false;

        const fetchReplacementProduct = async () => {
            if (!replacementItem?.productId) {
                setReplacementProduct(null);
                return;
            }

            try {
                const { data } = await API.get(`/products/${replacementItem.productId}?all=true`);
                if (!cancelled) setReplacementProduct(data);
            } catch (err) {
                if (!cancelled) setReplacementProduct(null);
            }
        };

        fetchReplacementProduct();

        return () => {
            cancelled = true;
        };
    }, [replacementItem?.productId]);

    const orderedReplacementVariant = useMemo(() => (
        replacementItem?.variant && typeof replacementItem.variant === 'object'
            ? replacementItem.variant
            : {}
    ), [replacementItem]);

    const orderedReplacementVariantEntries = useMemo(() => (
        Object.entries(orderedReplacementVariant).filter(([key, value]) =>
            key && value !== undefined && value !== null && String(value).trim() !== ''
        )
    ), [orderedReplacementVariant]);

    const replacementRequestedQuantity = useMemo(() => (
        replacementItem ? Math.max(1, Number(selectedItemQuantities[String(replacementItem.id)] || 1)) : 1
    ), [replacementItem, selectedItemQuantities]);

    const exactReplacementAvailability = useMemo(() => {
        if (!replacementItem) {
            return { checked: false, available: false, message: '' };
        }

        if (!replacementProduct) {
            return {
                checked: false,
                available: true,
                message: 'Checking exact same item availability for replacement...'
            };
        }

        const skus = Array.isArray(replacementProduct.skus) ? replacementProduct.skus : [];
        const hasVariantSnapshot = orderedReplacementVariantEntries.length > 0;

        if (hasVariantSnapshot && skus.length > 0) {
            const exactSku = skus.find((sku) => {
                const combination = sku?.combination && typeof sku.combination === 'object'
                    ? sku.combination
                    : {};

                return orderedReplacementVariantEntries.every(([key, value]) =>
                    String(combination[key] || '') === String(value)
                );
            });

            const isAvailable = Boolean(exactSku && Number(exactSku.stock || 0) >= replacementRequestedQuantity);
            return {
                checked: true,
                available: isAvailable,
                message: isAvailable
                    ? 'Replacement will be processed for the exact same product configuration.'
                    : 'Exact same product configuration is out of stock, so only refund is available right now.'
            };
        }

        const isAvailable = Number(replacementProduct.stock || 0) >= replacementRequestedQuantity;
        return {
            checked: true,
            available: isAvailable,
            message: isAvailable
                ? 'Replacement will be processed for the same product.'
                : 'This product is currently out of stock, so only refund is available right now.'
        };
    }, [replacementItem, replacementProduct, orderedReplacementVariantEntries, replacementRequestedQuantity]);

    useEffect(() => {
        const lowerEntries = orderedReplacementVariantEntries.map(([key, value]) => [String(key).toLowerCase(), String(value)]);
        const sizeLike = lowerEntries.find(([key]) => /size|storage|ram/i.test(key));
        const colorLike = lowerEntries.find(([key]) => /colou?r/i.test(key));

        setSelectedReplacementSize(sizeLike?.[1] || '');
        setSelectedReplacementColor(colorLike?.[1] || '');
    }, [orderedReplacementVariantEntries]);

    // UI Helper Components
    const ShimmerLoader = () => (
        <div className="max-w-[1000px] mx-auto p-4 md:p-10 space-y-8 animate-pulse bg-white min-h-screen">
            <div className="h-8 bg-gray-100 rounded-md w-1/4 mb-10"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <div className="h-40 bg-gray-50 rounded-2xl"></div>
                    <div className="h-60 bg-gray-50 rounded-2xl"></div>
                </div>
                <div className="space-y-6">
                    <div className="h-80 bg-gray-50 rounded-2xl"></div>
                </div>
            </div>
        </div>
    );

    const ProgressStepper = ({ currentStep }) => {
        const steps = ['Items', 'Choice', 'Reason', 'Details'];
        const activeStepIdx = currentStep === 0 ? 0 : currentStep === 3 ? 1 : currentStep <= 2 ? 2 : 3;

        return (
            <div className="w-full py-6 px-4 md:px-0">
                <div className="flex items-center justify-between max-w-sm mx-auto relative cursor-default select-none">
                    <div className="absolute top-[15px] left-0 w-full h-[2px] bg-gray-200 z-0"></div>
                    <div 
                        className="absolute top-[15px] left-0 h-[2px] bg-primary-600 z-0 transition-all duration-500"
                        style={{ width: `${(activeStepIdx / (steps.length - 1)) * 100}%` }}
                    ></div>
                    {steps.map((s, i) => (
                        <div key={s} className="relative z-10 flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 border-2 ${
                                i <= activeStepIdx ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-100' : 'bg-white border-gray-200 text-gray-400'
                            }`}>
                                {i < activeStepIdx ? <span className="material-icons text-sm">check</span> : i + 1}
                            </div>
                            <p className={`text-[9px] mt-2 font-black uppercase tracking-tight ${i <= activeStepIdx ? 'text-primary-600' : 'text-gray-400'}`}>
                                {s}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (returnMode === 'REPLACEMENT' && exactReplacementAvailability.checked && !exactReplacementAvailability.available) {
            switchReturnMode('REFUND');
        }
    }, [returnMode, exactReplacementAvailability]);

    if (loadingOrder) return <ShimmerLoader />;
    if (!order) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-10 bg-white animate-in fade-in duration-700">
            <span className="material-icons text-7xl text-gray-100 mb-6 animate-bounce">inventory_2</span>
            <h1 className="text-xl font-black text-gray-800 uppercase tracking-widest">Order not found</h1>
            <p className="text-gray-400 text-sm mt-2 font-bold uppercase tracking-tight">The details for this order could not be loaded.</p>
            <button onClick={() => navigate('/my-orders')} className="mt-8 px-10 py-3 bg-primary-600 text-white rounded-full font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary-100 hover:shadow-primary-200 active:scale-95 transition-all">Go to My Orders</button>
        </div>
    );

    const handleReturnSubmit = async () => {
        const showError = (message) => {
            toast.dismiss();
            toast.error(message);
        };

        if (!isWithinReturnWindow) {
            showError(`Return or replacement can only be requested within ${RETURN_WINDOW_DAYS} days of delivery.`);
            return;
        }
        if (targetItems.length === 0) {
            showError('No eligible items found for return/replacement in this order.');
            return;
        }
        if (selectedItems.length === 0) {
            showError('Please select at least one item.');
            return;
        }
        if (returnMode === 'REPLACEMENT' && selectedItems.length > 1) {
            showError('For replacement, please select only one item at a time.');
            return;
        }
        if (returnMode === 'REPLACEMENT' && exactReplacementAvailability.checked && !exactReplacementAvailability.available) {
            showError('Exact same product configuration is unavailable for replacement. Please choose refund.');
            return;
        }
        if (!selectedPickupAddress?.address || !selectedPickupAddress?.city || !selectedPickupAddress?.pincode) {
            showError('Please select a valid pickup address before submitting.');
            return;
        }

        if (!googleDriveLink.trim() && proofFiles.length === 0) {
            showError('Please add Google Drive link or upload proof files.');
            return;
        }

        if (returnMode === 'REFUND') {
            const accountHolderName = String(bankDetails.accountHolderName || '').trim();
            const accountNumber = String(bankDetails.accountNumber || '').trim();
            const ifscCode = String(bankDetails.ifscCode || '').trim().toUpperCase();
            const hasAnyBankField = Boolean(accountHolderName || accountNumber || ifscCode);

            if (hasAnyBankField) {
                if (!accountHolderName || !accountNumber || !ifscCode) {
                    showError('Please provide complete bank details (name, account number, IFSC).');
                    return;
                }
                if (/\d/.test(accountHolderName)) {
                    showError('Account Holder Name should not contain numbers');
                    return;
                }
                if (!ACCOUNT_NUMBER_REGEX.test(accountNumber)) {
                    showError('Account Number must be 9 to 18 digits');
                    return;
                }
                if (!IFSC_REGEX.test(ifscCode)) {
                    showError('IFSC must be in format: ABCD0123456');
                    return;
                }
            }
        }

        setLoading(true);
        try {
            for (const item of selectedItems) {
                const payload = new FormData();
                payload.append('orderId', order.id);
                payload.append('productId', item.productId);
                payload.append('orderItemId', item.orderItemId || item.id);
                payload.append('type', returnMode === 'REFUND' ? 'Return' : 'Replacement');
                payload.append('requestedQuantity', String(selectedItemQuantities[String(item.id)] || 1));
                payload.append('reason', reason);
                payload.append('comment', `${subReason}. ${comment}`.trim());
                payload.append('googleDriveLink', googleDriveLink.trim());
                payload.append('pickupAddress', JSON.stringify(selectedPickupAddress || {}));

                if (returnMode === 'REPLACEMENT') {
                    payload.append('selectedReplacementSize', selectedReplacementSize);
                    payload.append('selectedReplacementColor', selectedReplacementColor);
                }
                if (returnMode === 'REFUND') {
                    payload.append('bankDetails', JSON.stringify(bankDetails));
                }

                proofFiles.forEach((file) => payload.append('proof_files', file));
                
                await API.post('/returns', payload, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            toast.dismiss();
            toast.success(`${returnMode === 'REFUND' ? 'Return' : 'Replacement'} request submitted successfully!`);
            navigate(`/my-orders/${order.id}`);
        } catch (error) {
            console.error(error);
            showError(error.response?.data?.message || 'Failed to submit return request.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#f5f7fa] min-h-screen pb-10 font-sans">
            {/* Mobile-only Header */}
            <div className="bg-white px-4 py-4 flex items-center gap-3 border-b sticky top-0 z-[60] md:hidden">
                <button onClick={() => navigate(-1)} className="material-icons p-1 -ml-1 text-gray-700">arrow_back</button>
                <h1 className="text-base font-bold text-gray-800">Return / Replacement</h1>
            </div>

            {/* Desktop Navigation & Breadcrumbs */}
            <div className="hidden md:block bg-white border-b py-3 px-6 mb-6">
                <div className="max-w-[1200px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <span onClick={() => navigate('/')} className="cursor-pointer hover:text-primary-600 transition-colors uppercase tracking-tight">Home</span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span onClick={() => navigate('/my-orders')} className="cursor-pointer hover:text-primary-600 transition-colors uppercase tracking-tight">My Orders</span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-gray-800 font-bold uppercase tracking-tight">Return Flow</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order ID: #{order?.displayId || orderId.slice(-8).toUpperCase()}</p>
                    </div>
                </div>
            </div>

            <div className="max-w-[1000px] mx-auto px-4">
                {/* Stepper Logic */}
                <ProgressStepper currentStep={step} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 items-start pb-20 md:pb-0">
                    {/* Left Side: Step Content */}
                    <div className="lg:col-span-2 space-y-4">
                        
                        {!productId && targetItems.length > 0 && step === 0 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-primary-50/50 to-transparent">
                                    <div>
                                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Select Products</h3>
                                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Step 1: Choose item(s) to return or replace</p>
                                    </div>
                                    <span className="material-icons text-primary-100 text-3xl">inventory_2</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    {targetItems.map((item) => {
                                        const isSelected = selectedItemIds.includes(String(item.id));
                                        const selectedQty = selectedItemQuantities[String(item.id)] || 1;
                                        const maxQty = Math.max(1, Number(item.returnableQuantity || item.quantity || 1));
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleItemSelectionChange(item.id, !isSelected)}
                                                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                                                    isSelected ? 'border-primary-600 bg-primary-50 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="w-16 h-16 bg-white rounded-xl border border-gray-100 p-1.5 flex-shrink-0">
                                                        <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 line-clamp-2">{item.name}</p>
                                                        <p className="text-[11px] text-gray-500 mt-1">
                                                            Ordered Qty: {item.quantity} | Available: {item.returnableQuantity} | Rs. {item.price?.toLocaleString?.() || item.price}
                                                        </p>
                                                        {item.returnMeta?.latestRejectedReason && (
                                                            <p className="text-[10px] text-red-600 mt-1 font-semibold">
                                                                Last reject reason: {item.returnMeta.latestRejectedReason}
                                                            </p>
                                                        )}
                                                        {isSelected && maxQty > 1 && (
                                                            <div
                                                                className="mt-3 flex items-center gap-3"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Select Qty</span>
                                                                <div className="flex items-center overflow-hidden rounded-xl border border-primary-200 bg-white">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSelectedQuantityChange(item.id, selectedQty - 1, maxQty)}
                                                                        className="w-9 h-9 flex items-center justify-center text-primary-600 hover:bg-primary-50"
                                                                    >
                                                                        <span className="material-icons text-base">remove</span>
                                                                    </button>
                                                                    <span className="w-10 text-center text-sm font-black text-primary-700">{selectedQty}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSelectedQuantityChange(item.id, selectedQty + 1, maxQty)}
                                                                        className="w-9 h-9 flex items-center justify-center text-primary-600 hover:bg-primary-50"
                                                                    >
                                                                        <span className="material-icons text-base">add</span>
                                                                    </button>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-gray-400">of {maxQty}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className={`material-icons ${isSelected ? 'text-primary-600' : 'text-gray-300'}`}>
                                                        {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        onClick={() => setStep(3)}
                                        disabled={selectedItemIds.length === 0}
                                        className={`mt-3 w-full h-12 rounded-2xl font-black text-[11px] uppercase tracking-[0.18em] transition-all ${
                                            selectedItemIds.length === 0
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-100'
                                        }`}
                                    >
                                        Continue
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 1: Reason Selection */}
                        {step === 1 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-primary-50/50 to-transparent">
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={() => setStep(3)} className="material-icons text-gray-400 hover:text-primary-600 transition-colors">arrow_back</button>
                                        <div>
                                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Select Reason</h3>
                                            <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold">Step 2 of 4: Tell us what's wrong</p>
                                        </div>
                                    </div>
                                    <span className="material-icons text-primary-100 text-3xl">help_outline</span>
                                </div>
                                <div className="p-2 md:p-4">
                                    <div className="grid grid-cols-1 gap-1">
                                        {reasons.map((r) => (
                                            <button
                                                key={r.title}
                                                onClick={() => {
                                                    setReason(r.title);
                                                    setStep(2);
                                                }}
                                                className="group flex items-center justify-between p-4 rounded-xl hover:bg-primary-50 transition-all duration-300 text-left border border-transparent hover:border-primary-100"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-white transition-colors">
                                                        <span className="material-icons text-gray-400 group-hover:text-primary-600 text-xl">report_problem</span>
                                                    </div>
                                                    <span className="text-sm text-gray-700 font-bold group-hover:text-primary-700 transition-colors leading-tight">{r.title}</span>
                                                </div>
                                                <span className="material-icons text-gray-300 group-hover:translate-x-1 group-hover:text-primary-600 transition-all">chevron_right</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Sub-reason */}
                        {step === 2 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <button type="button" onClick={() => setStep(1)} className="material-icons text-gray-400 hover:text-primary-600 transition-colors">arrow_back</button>
                                        <div>
                                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">More Details</h3>
                                            <p className="text-[10px] text-primary-600 mt-1 uppercase font-bold">Step 3 of 4 â€¢ {reason}</p>
                                        </div>
                                    </div>
                                    <span className="material-icons text-primary-100 text-3xl">list</span>
                                </div>
                                <div className="p-4 md:p-6 space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Select specific issue</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {reasons.find(r => r.title === reason)?.subs.map(sub => (
                                            <button
                                                key={sub}
                                                onClick={() => {
                                                    setSubReason(sub);
                                                    setStep(4);
                                                }}
                                                className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all group ${
                                                    subReason === sub 
                                                    ? 'border-primary-600 bg-primary-50' 
                                                    : 'border-gray-50 hover:bg-gray-50 hover:border-gray-200'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-[13px] font-bold ${subReason === sub ? 'text-primary-700' : 'text-gray-600'}`}>{sub}</span>
                                                    {subReason === sub && <span className="material-icons text-primary-600 text-sm">check_circle</span>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Resolution Decision */}
                        {step === 3 && (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                                <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between bg-primary-600 text-white">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest">Resolution Choice</h3>
                                        <p className="text-[10px] text-white/70 mt-1 uppercase font-bold">Step 1 of 4: What do you want to do?</p>
                                    </div>
                                </div>
                                <div className="p-4 md:p-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Refund */}
                                        <div 
                                            onClick={() => {
                                                switchReturnMode('REFUND');
                                            }}
                                            className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 group ${
                                                returnMode === 'REFUND' ? 'border-primary-600 bg-primary-50 shadow-xl shadow-primary-50/50 lg:scale-[1.02]' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center transition-all ${
                                                returnMode === 'REFUND' ? 'bg-primary-600 text-white shadow-lg shadow-primary-200 animate-bounce-short' : 'bg-gray-50 text-gray-400 group-hover:bg-white'
                                            }`}>
                                                <span className="material-icons text-2xl">account_balance_wallet</span>
                                            </div>
                                            <h4 className="font-black text-sm uppercase tracking-tight text-gray-900">Refund / Return</h4>
                                            <p className="text-[11px] text-gray-900 mt-2 leading-relaxed">Original payment source or bank account. Average time: 5-7 working days after pickup.</p>
                                            {returnMode === 'REFUND' && <span className="absolute top-4 right-4 material-icons text-primary-600">check_circle</span>}
                                        </div>

                                        {/* Replacement */}
                                        <div 
                                            onClick={() => {
                                                if (exactReplacementAvailability.checked && !exactReplacementAvailability.available) return;
                                                switchReturnMode('REPLACEMENT');
                                            }}
                                            className={`relative p-6 rounded-2xl border-2 transition-all duration-300 group ${
                                                returnMode === 'REPLACEMENT' 
                                                ? 'border-green-600 bg-green-50 shadow-xl shadow-green-50/50 lg:scale-[1.02]' 
                                                : exactReplacementAvailability.checked && !exactReplacementAvailability.available
                                                  ? 'border-gray-100 opacity-40 cursor-not-allowed'
                                                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 cursor-pointer'
                                            }`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center transition-all ${
                                                returnMode === 'REPLACEMENT' ? 'bg-green-600 text-white shadow-lg shadow-green-200 animate-bounce-short' : 'bg-gray-50 text-gray-400 group-hover:bg-white'
                                            }`}>
                                                <span className="material-icons text-2xl">published_with_changes</span>
                                            </div>
                                            <h4 className="font-black text-sm uppercase tracking-tight text-gray-900">Replacement</h4>
                                            <p className="text-[11px] text-gray-900 mt-2 leading-relaxed">Swap for another unit of the same item. Subject to availability.</p>
                                            
                                            {exactReplacementAvailability.checked && !exactReplacementAvailability.available && (
                                                <div className="mt-3 py-1.5 px-3 bg-red-100/50 border border-red-200 rounded-lg">
                                                    <p className="text-[9px] font-bold text-red-700 uppercase tracking-tight">Out of Stock</p>
                                                </div>
                                            )}
                                            {returnMode === 'REPLACEMENT' && <span className="absolute top-4 right-4 material-icons text-green-600">check_circle</span>}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-between text-gray-900">
                                        <div className="flex items-center gap-2">
                                            <span className="material-icons text-lg">verified_user</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest leading-none text-gray-900">Safe & Secure process</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse"></span>
                                            <span className="text-[10px] font-bold text-gray-900 uppercase tracking-widest leading-none">Trusted Flow</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (returnMode === 'REPLACEMENT' && selectedItems.length > 1) {
                                                toast.error('Replacement can be requested for one product at a time.');
                                                return;
                                            }
                                            setStep(1);
                                        }}
                                        disabled={selectedItemIds.length === 0 || (returnMode === 'REPLACEMENT' && exactReplacementAvailability.checked && !exactReplacementAvailability.available)}
                                        className={`mt-6 w-full h-12 rounded-2xl font-black text-[11px] uppercase tracking-[0.18em] transition-all ${
                                            selectedItemIds.length === 0 || (returnMode === 'REPLACEMENT' && exactReplacementAvailability.checked && !exactReplacementAvailability.available)
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-100'
                                        }`}
                                    >
                                        Continue with {returnMode === 'REPLACEMENT' ? 'Replacement' : 'Return'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 4: Submit Details */}
                        {step === 4 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Final Details</h3>
                                            <p className="text-[10px] text-gray-900 mt-1 uppercase font-bold">Step 4 of 4: Complete your request</p>
                                        </div>
                                        <button type="button" onClick={() => setStep(3)} className="text-primary-600 font-black text-[10px] uppercase hover:underline border border-primary-100 px-2 py-1 rounded">Edit Choice</button>
                                    </div>
                                    
                                    <div className="p-6 space-y-6">
                                        {/* Comments */}
                                        <div>
                                            <label className="text-[10px] font-black text-gray-900 uppercase tracking-widest block mb-2">Detailed Comments</label>
                                            <textarea
                                                className="w-full bg-gray-50 border border-gray-300 focus:border-primary-500 focus:bg-white rounded-xl p-4 text-sm outline-none transition-all h-28 text-gray-800 placeholder-gray-300 resize-none"
                                                placeholder="Tell us more about the issue (e.g. Item damaged, missing parts)..."
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                            ></textarea>
                                        </div>

                                        {/* Bank Details (Refund only) */}
                                        {returnMode === 'REFUND' && (
                                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200/50">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <span className="material-icons text-primary-600 text-xl">payments</span>
                                                    <h4 className="text-xs font-black uppercase text-gray-700 tracking-tight">Bank Account for Refund</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Account Holder</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="NAME ON ACCOUNT"
                                                            className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary-500 font-bold text-gray-800 uppercase"
                                                            value={bankDetails.accountHolderName}
                                                            onChange={(e) => setBankDetails(p => ({ ...p, accountHolderName: e.target.value.replace(/\d/g, '') }))}
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Account Number</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="1234 5678 9012"
                                                            className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary-500 font-bold text-gray-800"
                                                            inputMode="numeric"
                                                            maxLength={22}
                                                            value={formatAccountNumber(bankDetails.accountNumber)}
                                                            onChange={(e) => setBankDetails(p => ({ ...p, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) }))}
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2 space-y-1 mt-1">
                                                        <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">IFSC Code</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="SBIN0001234"
                                                            className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary-500 font-bold text-gray-800 uppercase"
                                                            value={bankDetails.ifscCode}
                                                            onChange={(e) => setBankDetails(p => ({ ...p, ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,11) }))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Proof Uploads */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Evidence / Proof (Required)</label>
                                            <div className="flex flex-col gap-3">
                                                <div className="flex-1 border-2 border-dashed border-gray-200 hover:border-primary-400 rounded-2xl p-8 transition-all bg-gray-50/50 text-center relative group">
                                                    <input 
                                                        type="file" multiple accept="image/*,video/*"
                                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                        onChange={(e) => {
                                                            const files = Array.from(e.target.files || []);
                                                            if (files.some(f => f.size > 10 * 1024 * 1024)) {
                                                                toast.error("Files must be under 10MB");
                                                                return;
                                                            }
                                                            setProofFiles(files);
                                                        }}
                                                    />
                                                    <span className="material-icons text-5xl text-gray-300 group-hover:text-primary-500 transition-colors">cloud_upload</span>
                                                    <p className="text-xs font-bold text-gray-600 mt-2">Click or drag to upload proof</p>
                                                    <p className="text-[9px] text-gray-400 mt-1 uppercase font-bold tracking-tight">JPG, PNG or MP4 (Max 10MB)</p>
                                                    
                                                    {proofFiles.length > 0 && (
                                                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                                                            {proofFiles.map((f, i) => (
                                                                <div key={i} className="flex items-center gap-1 bg-primary-600 text-white px-3 py-1 rounded-full text-[9px] font-bold shadow-lg">
                                                                    <span className="material-icons text-[10px]">attachment</span>
                                                                    {f.name.slice(0,12)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                                        <span className="material-icons text-gray-400 text-lg">link</span>
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Or paste Google Drive/Files Link here..."
                                                        className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-xs outline-none focus:ring-1 focus:ring-primary-500 font-bold text-gray-500 uppercase tracking-tight"
                                                        value={googleDriveLink}
                                                        onChange={(e) => setGoogleDriveLink(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={handleReturnSubmit}
                                            disabled={loading}
                                            className={`w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-[0.98] mt-4 ${
                                                loading 
                                                ? 'bg-gray-100 text-gray-400 shadow-none cursor-default' 
                                                : 'bg-primary-600 text-white shadow-primary-100 hover:bg-primary-700 hover:-translate-y-0.5'
                                            }`}
                                        >
                                            {loading ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    <span>Processing...</span>
                                                </div>
                                            ) : `Complete ${returnMode === 'REFUND' ? 'Return' : 'Replacement'}`}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Sidebar Summary */}
                    <div className="space-y-6">
                        {/* Order & Item Summary */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Applying to item</h4>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${returnMode === 'REPLACEMENT' ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-700'}`}>
                                    {returnMode === 'REPLACEMENT' ? 'Replacement' : 'Refund'}
                                </span>
                            </div>
                            <div className="p-4 space-y-4">
                                {(selectedItems.length > 0 ? selectedItems : targetItems).map((item, idx) => (
                                    <div key={idx} className="flex gap-4 items-start">
                                        <div className="w-20 h-20 rounded-xl bg-gray-50 p-2 flex-shrink-0 border border-gray-100">
                                            <img src={item.image} className="w-full h-full object-contain" alt="" />
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            <p className="text-xs font-bold text-gray-800 line-clamp-2 leading-snug tracking-tight uppercase mb-1">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-black tracking-widest leading-none">
                                                Price: Rs. {item.price.toLocaleString()} | Selected Qty: {selectedItemQuantities[String(item.id)] || 1}{item.quantity > 1 ? ` / ${item.returnableQuantity || item.quantity}` : ''}
                                            </p>
                                            {item.variant && Object.entries(item.variant).length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {Object.entries(item.variant).map(([k, v]) => (
                                                        <span key={k} className="text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase">{k}: {v}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pickup Logistics */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pickup Address</h4>
                                <button
                                    type="button"
                                    onClick={() => setShowAddressSelector(!showAddressSelector)}
                                    className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-700 transition-all"
                                >
                                    {showAddressSelector ? 'Close' : 'Change'}
                                </button>
                            </div>
                            <div className="p-5">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                                        <span className="material-icons text-primary-600 text-lg">local_shipping</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-black text-gray-800 uppercase tracking-tight">{selectedPickupAddress?.name || 'Customer'}</p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{selectedPickupAddress?.type || 'Pickup address'}</p>
                                        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
                                            {selectedPickupAddress?.address}, {selectedPickupAddress?.city}{selectedPickupAddress?.state ? `, ${selectedPickupAddress.state}` : ''} - {selectedPickupAddress?.pincode}
                                        </p>
                                        <p className="text-[11px] font-bold text-primary-600 mt-2 tracking-widest">{selectedPickupAddress?.phone}</p>
                                    </div>
                                </div>

                                {showAddressSelector && (
                                    <div className="mt-6 pt-6 border-t border-gray-100 space-y-2 max-h-60 overflow-y-auto pr-1">
                                        <button
                                            type="button"
                                            onClick={handleSelectOrderShippingAddress}
                                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                                selectedPickupAddressId === 'order-shipping' ? 'border-primary-600 bg-primary-50/50 shadow-md' : 'border-gray-100 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight">Order Delivery Address</p>
                                                {selectedPickupAddressId === 'order-shipping' && <span className="material-icons text-primary-600 text-sm">check_circle</span>}
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-1">
                                                {order?.shippingAddress?.street}, {order?.shippingAddress?.city} - {order?.shippingAddress?.postalCode}
                                            </p>
                                            {!!order?.shippingAddress?.phone && (
                                                <p className="text-[10px] text-primary-600 font-bold mt-1">{order.shippingAddress.phone}</p>
                                            )}
                                        </button>

                                        {addresses.map((addr) => (
                                            <button
                                                type="button"
                                                key={addr.id}
                                                onClick={() => handleSelectPickupAddress(addr)}
                                                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                                    selectedPickupAddressId === addr.id ? 'border-primary-600 bg-primary-50/50 shadow-md' : 'border-gray-50 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight">{addr.type || 'HOME'}</p>
                                                    {selectedPickupAddressId === addr.id && <span className="material-icons text-primary-600 text-sm">check_circle</span>}
                                                </div>
                                                <p className="text-[10px] text-gray-500 mt-1">{addr.name}</p>
                                                <p className="text-[10px] text-gray-500 mt-1">{addr.address}, {addr.city} - {addr.pincode}</p>
                                                {!!(addr.mobile || addr.phone) && (
                                                    <p className="text-[10px] text-primary-600 font-bold mt-1">{addr.mobile || addr.phone}</p>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Guidelines Card */}
                        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-2xl">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-icons text-primary-400">info_outline</span>
                                <h5 className="text-[10px] font-black uppercase tracking-widest">Guidelines</h5>
                            </div>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-2">
                                    <span className="material-icons text-[12px] mt-0.5 text-primary-400">lens</span>
                                    <p className="text-[10px] font-bold tracking-tight opacity-90">Keep original packaging and tags intact.</p>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="material-icons text-[12px] mt-0.5 text-primary-400">lens</span>
                                    <p className="text-[10px] font-bold tracking-tight opacity-90">Clear all personal data/locks (for electronics).</p>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="material-icons text-[12px] mt-0.5 text-primary-400">lens</span>
                                    <p className="text-[10px] font-bold tracking-tight opacity-90">Pickup is verified by our executive agent.</p>
                                </li>
                            </ul>
                            <button onClick={() => navigate('/help-center')} className="mt-6 w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-white/10">Help Center</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        );
};

export default ReturnOrder;



