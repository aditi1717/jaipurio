import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdSearch, MdCheckCircle, MdCancel, MdPendingActions, MdHistory, MdVisibility, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import useReturnStore from '../../store/returnStore';
import API from '../../../../services/api';
import toast from 'react-hot-toast';
import AdminTable, { AdminTableHead, AdminTableHeaderCell, AdminTableHeaderRow } from '../../components/common/AdminTable';

const ReturnRequests = ({ forcedType = 'All', pageTitle = 'Returns & Replacements', pageDescription = 'Manage lifecycle of return and replacement requests' }) => {
    const navigate = useNavigate();
    const { returns, updateReturnStatus, fetchReturns } = useReturnStore();
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState(forcedType);
    const [pickupMode, setPickupMode] = useState('manual');
    const [pickupAwb, setPickupAwb] = useState('');
    const [pickupDate, setPickupDate] = useState('');
    const [pickupNotes, setPickupNotes] = useState('');
    const [isAssigningPickup, setIsAssigningPickup] = useState(false);

    useEffect(() => {
        fetchReturns();
    }, [fetchReturns]);

    useEffect(() => {
        setTypeFilter(forcedType);
        setCurrentPage(1);
    }, [forcedType]);

    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [selectedProof, setSelectedProof] = useState(null);
    const [nextStatus, setNextStatus] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const normalizeSearchValue = (value) => String(value || '').toLowerCase().replace(/\s+/g, '');

    const visibleReturns = returns.filter((ret) => ret.type !== 'Cancellation');

    const filteredReturns = visibleReturns.filter(ret => {
        const normalizedSearch = normalizeSearchValue(searchTerm);
        const matchesSearch =
            !normalizedSearch ||
            normalizeSearchValue(ret.orderId).includes(normalizedSearch) ||
            normalizeSearchValue(ret.customer).includes(normalizedSearch) ||
            normalizeSearchValue(ret.id).includes(normalizedSearch);
        const matchesType = typeFilter === 'All' || ret.type === typeFilter;
        const matchesStatus = statusFilter === 'All' || ret.status === statusFilter;
        return matchesSearch && matchesType && matchesStatus;
    });

    const totalPages = Math.ceil(filteredReturns.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedReturns = filteredReturns.slice(startIndex, startIndex + itemsPerPage);

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Pending': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'Approved': return 'bg-primary-50 text-primary-600 border-primary-100';
            case 'Pickup Scheduled': return 'bg-purple-50 text-purple-600 border-purple-100';
            case 'Received at Warehouse': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
            case 'Refund Initiated':
            case 'Replacement Dispatched': return 'bg-cyan-50 text-cyan-600 border-cyan-100';
            case 'Refunded':
            case 'Returned':
            case 'Replaced':
            case 'Completed': return 'bg-green-50 text-green-600 border-green-100';
            case 'Rejected': return 'bg-red-50 text-red-600 border-red-100';
            default: return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleStatusUpdate = async (id, newStatus, note = '') => {
        await updateReturnStatus(id, newStatus, note);
        setSelectedReturn((prev) => prev ? { ...prev, status: newStatus } : prev);
    };

    const handleAssignPickup = async () => {
        if (!selectedReturn) return;

        const mode = pickupMode;
        const awb = pickupAwb.trim();
        if (['ekart', 'delhivery'].includes(mode) && !awb) {
            toast.error('Enter the reverse pickup AWB from the courier panel');
            return;
        }

        setIsAssigningPickup(true);
        try {
            const { data } = await API.put(`/returns/${selectedReturn._id || selectedReturn.id}/fulfillment`, {
                mode,
                trackingNumber: awb,
                pickupScheduledAt: pickupDate || undefined,
                notes: pickupNotes.trim()
            });
            setSelectedReturn(data);
            toast.success(mode === 'manual' ? 'Manual pickup assigned' : `${mode} pickup assigned`);
            fetchReturns();
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to assign pickup');
        } finally {
            setIsAssigningPickup(false);
        }
    };

    const handleRejectWithReason = async (id) => {
        const reason = window.prompt('Enter reject reason');
        if (reason === null) return;
        const trimmedReason = String(reason || '').trim();
        if (!trimmedReason) {
            window.alert('Reject reason is required.');
            return;
        }
        await handleStatusUpdate(id, 'Rejected', trimmedReason);
    };

    const handleOpenCustomerProfile = async (ret) => {
        try {
            let userId = String(ret?.userId || '').trim();

            if (!userId && ret?.orderId) {
                const { data } = await API.get(`/orders/${ret.orderId}`);
                userId = String(data?.user?._id || data?.user?.id || '').trim();
            }

            if (!userId) {
                window.alert('Customer profile could not be opened for this request.');
                return;
            }

            setSelectedReturn(null);
            navigate(`/admin/users/${userId}`);
        } catch (error) {
            window.alert('Failed to open customer profile.');
        }
    };

    const isVideoUrl = (url = '') => /\.(mp4|mov|webm|mkv|avi)(\?|$)/i.test(url);
    const formatLifecycleTime = (value) => {
        if (!value) return '--';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '--';
        return parsed.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    };

    const hasRefundFlow = (ret) => {
        const timeline = Array.isArray(ret?.timeline) ? ret.timeline : [];
        return timeline.some((entry) => String(entry?.status || '').trim() === 'Refund Initiated');
    };

    const getLifecycleSteps = (type) => {
        if (type === 'Cancellation') return ['Pending', 'Approved', 'Completed'];
        if (type === 'Replacement') return ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Replacement Dispatched', 'Completed'];
        return ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Refund Initiated', 'Completed'];
    };

    const getLifecycleStepsForRequest = (ret) => {
        if (!ret) return [];
        if (ret.type === 'Replacement' && hasRefundFlow(ret)) {
            return ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Refund Initiated', 'Completed'];
        }
        return getLifecycleSteps(ret.type);
    };

    const getFilterStatusOptions = () => {
        if (forcedType === 'Return') {
            return ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Refund Initiated', 'Completed', 'Rejected'];
        }
        if (forcedType === 'Replacement') {
            return ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Refund Initiated', 'Replacement Dispatched', 'Completed', 'Rejected'];
        }
        return ['Pending', 'Approved', 'Pickup Scheduled', 'Received at Warehouse', 'Refund Initiated', 'Replacement Dispatched', 'Completed', 'Rejected'];
    };

    const getDisplayStatusLabel = (type, status, ret = null) => {
        const normalizedType = String(type || '').trim();
        const refundFlow = hasRefundFlow(ret);
        if (normalizedType === 'Return' && String(status || '').trim() === 'Completed') {
            return 'Returned';
        }
        if (normalizedType === 'Replacement' && String(status || '').trim() === 'Completed' && refundFlow) {
            return 'Refunded';
        }
        if (normalizedType === 'Replacement' && String(status || '').trim() === 'Completed') {
            return 'Replaced';
        }
        return status;
    };

    const getStatusOptions = (ret) => {
        if (!ret) return [];
        if (ret.status === 'Completed' || ret.status === 'Rejected') return [];

        const steps = getLifecycleSteps(ret.type);
        const currentIndex = steps.indexOf(ret.status);
        if (currentIndex === -1) return [];

        let forwardStatuses = steps.slice(currentIndex + 1);

        if (ret.type === 'Replacement' && ['Approved', 'Pickup Scheduled', 'Received at Warehouse'].includes(ret.status)) {
            forwardStatuses = [...forwardStatuses.filter((status) => status !== 'Refund Initiated'), 'Refund Initiated'];
        }

        if (ret.status === 'Pending') {
            return [...forwardStatuses, 'Rejected'];
        }

        return forwardStatuses;
    };

    const getActionLabel = (status, type, ret = null) => {
        if (status === 'Approved') return type === 'Cancellation' ? 'Approve Cancellation' : 'Approve Request';
        if (status === 'Rejected') return type === 'Cancellation' ? 'Reject Cancellation' : 'Reject Request';
        if (status === 'Pickup Scheduled') return 'Schedule Pickup';
        if (status === 'Received at Warehouse') return 'Confirm Item Received';
        if (status === 'Refund Initiated') return 'Initiate Refund';
        if (status === 'Replacement Dispatched') return 'Dispatch Replacement';
        if (status === 'Completed') {
            if (type === 'Return') return 'Mark as Returned';
            if (type === 'Replacement' && hasRefundFlow(ret)) return 'Mark as Refunded';
            if (type === 'Replacement') return 'Mark as Replaced';
            return 'Mark as Completed';
        }
        return 'Update Status';
    };

    useEffect(() => {
        if (!selectedReturn) return;
        const options = getStatusOptions(selectedReturn);
        setNextStatus(options[0] || '');
    }, [selectedReturn]);

    useEffect(() => {
        if (!selectedReturn) return;
        const refreshedReturn = returns.find((ret) =>
            (selectedReturn._id && ret._id === selectedReturn._id) ||
            (selectedReturn.id && ret.id === selectedReturn.id)
        );
        if (refreshedReturn) {
            setSelectedReturn(refreshedReturn);
        }
    }, [returns, selectedReturn?._id, selectedReturn?.id]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">{pageTitle}</h1>
                    <p className="text-sm text-gray-500 font-medium italic">{pageDescription}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by ID, Order #, or Customer..."
                        className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all text-sm text-gray-900 placeholder:text-gray-900 font-bold"
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                    />
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {forcedType === 'All' && (
                        <select
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-primary-500 text-sm font-black text-gray-900 min-w-[130px]"
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                        >
                            <option value="All">All Types</option>
                            <option value="Return">Return</option>
                            <option value="Replacement">Replacement</option>
                        </select>
                    )}
                    <select
                        className="flex-1 lg:flex-none px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-primary-500 text-sm font-black text-gray-900 min-w-[150px]"
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                    >
                            <option value="All">All Statuses</option>
                        {getFilterStatusOptions().map((status) => (
                            <option key={status} value={status}>
                                {getDisplayStatusLabel(forcedType === 'All' ? typeFilter : forcedType, status)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <AdminTable>
                        <AdminTableHead>
                            <AdminTableHeaderRow>
                                <AdminTableHeaderCell>Request Info</AdminTableHeaderCell>
                                <AdminTableHeaderCell>Customer</AdminTableHeaderCell>
                                <AdminTableHeaderCell>Product</AdminTableHeaderCell>
                                <AdminTableHeaderCell className="text-center">Status</AdminTableHeaderCell>
                                <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
                            </AdminTableHeaderRow>
                        </AdminTableHead>
                        <tbody className="divide-y divide-gray-200">
                            {paginatedReturns.map(ret => (
                                <tr key={ret.id} className="hover:bg-primary-50/10 transition-colors group">
                                    <td className="px-5 py-3">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-gray-900">{ret.id}</span>
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${ret.type === 'Return' ? 'bg-orange-100 text-orange-600' :
                                                        ret.type === 'Replacement' ? 'bg-purple-100 text-purple-600' :
                                                            'bg-red-100 text-red-600'
                                                    }`}>
                                                    {ret.type}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-primary-600 mt-1 uppercase tracking-tighter">Order: {ret.orderDisplayId || ret.orderId}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCustomerProfile(ret)}
                                            className="text-[11px] font-black text-primary-700 hover:text-primary-800 hover:underline transition-all text-left"
                                            title="Open customer profile"
                                        >
                                            {ret.customer || 'N/A'}
                                        </button>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                                                <img src={ret.product.image} className="w-full h-full object-contain p-1" alt="" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-[11px] font-bold text-gray-800 truncate max-w-[150px]">{ret.product.name}</h4>
                                                <p className="text-[10px] font-black text-gray-900">₹{ret.product.price.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-tighter shadow-sm ${getStatusStyle(getDisplayStatusLabel(ret.type, ret.status, ret))}`}>
                                            {getDisplayStatusLabel(ret.type, ret.status, ret)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setSelectedReturn(ret)}
                                                className="w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-primary-600 text-gray-400 hover:text-white rounded-xl transition-all shadow-sm border border-transparent hover:border-primary-700"
                                            >
                                                <MdVisibility size={20} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
            </AdminTable>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white px-8 py-4 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        PAGE {currentPage} OF {totalPages}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-white border border-transparent hover:border-gray-100 disabled:opacity-30 transition-all shadow-sm"
                        >
                            <MdChevronLeft size={24} />
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-white border border-transparent hover:border-gray-100 disabled:opacity-30 transition-all shadow-sm"
                        >
                            <MdChevronRight size={24} />
                        </button>
                    </div>
                </div>
            )}

            {/* Status Flow Modal */}
            {selectedReturn && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col md:flex-row max-h-[90vh]">
                        {/* Left Side: Info */}
                        <div className="md:w-1/2 p-8 border-b md:border-b-0 md:border-r border-gray-100 overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${selectedReturn.type === 'Return' ? 'bg-orange-100 text-orange-600' :
                                        selectedReturn.type === 'Replacement' ? 'bg-purple-100 text-purple-600' :
                                            'bg-red-100 text-red-600'
                                    }`}>
                                    {selectedReturn.type} {selectedReturn.type === 'Cancellation' ? 'Request' : 'Order'}
                                </span>
                                <button onClick={() => setSelectedReturn(null)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 md:hidden"><MdCancel size={24} /></button>
                            </div>

                            {/* Reverse pickup — same shape as the orders fulfillment flow */}
                            {selectedReturn.type !== 'Cancellation' && (
                                <div className="mb-6 rounded-2xl border border-gray-150 bg-gray-50/70 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-500">Reverse Pickup</p>
                                        {selectedReturn.fulfillment?.mode && selectedReturn.fulfillment.mode !== 'unassigned' && (
                                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
                                                {selectedReturn.fulfillment.mode}
                                                {selectedReturn.fulfillment.trackingNumber ? ` · ${selectedReturn.fulfillment.trackingNumber}` : ''}
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={pickupMode}
                                            onChange={(e) => setPickupMode(e.target.value)}
                                            disabled={isAssigningPickup}
                                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-primary-500"
                                        >
                                            <option value="manual">Manual (own staff)</option>
                                            <option value="ekart">Ekart</option>
                                            <option value="delhivery">Delhivery</option>
                                        </select>
                                        <input
                                            type="date"
                                            value={pickupDate}
                                            onChange={(e) => setPickupDate(e.target.value)}
                                            disabled={isAssigningPickup}
                                            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-900 outline-none focus:border-primary-500"
                                        />
                                    </div>

                                    {['ekart', 'delhivery'].includes(pickupMode) && (
                                        <>
                                            <input
                                                type="text"
                                                value={pickupAwb}
                                                onChange={(e) => setPickupAwb(e.target.value)}
                                                disabled={isAssigningPickup}
                                                placeholder="Reverse pickup AWB"
                                                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-900 outline-none focus:border-primary-500"
                                            />
                                            <p className="mt-1 text-[10px] font-semibold text-amber-700">
                                                Create the reverse pickup in the {pickupMode === 'ekart' ? 'Ekart' : 'Delhivery'} panel, then paste its AWB here.
                                            </p>
                                        </>
                                    )}

                                    <input
                                        type="text"
                                        value={pickupNotes}
                                        onChange={(e) => setPickupNotes(e.target.value)}
                                        disabled={isAssigningPickup}
                                        placeholder="Notes (optional)"
                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-primary-500"
                                    />

                                    <button
                                        type="button"
                                        onClick={handleAssignPickup}
                                        disabled={isAssigningPickup}
                                        className="mt-3 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white hover:bg-primary-700 disabled:bg-primary-300"
                                    >
                                        {isAssigningPickup ? 'Assigning...' : 'Assign Pickup'}
                                    </button>
                                </div>
                            )}

                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="w-24 h-24 bg-gray-50 rounded-2xl border border-gray-100 p-2 overflow-hidden flex-shrink-0">
                                        <img src={selectedReturn.product.image} className="w-full h-full object-contain" alt="" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-black text-gray-900 leading-tight mb-2">{selectedReturn.id}</h3>
                                        <p className="text-sm font-bold text-gray-600 line-clamp-2">{selectedReturn.product.name}</p>
                                        <p className="text-lg font-black text-gray-900 mt-2">₹{selectedReturn.product.price.toLocaleString()}</p>
                                        {!!selectedReturn.requestedQuantity && (
                                            <p className="text-[11px] font-bold text-gray-500 mt-1 uppercase tracking-wider">
                                                Requested Qty: {selectedReturn.requestedQuantity}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Customer Report</p>
                                        <p className="text-sm font-black text-gray-800">{selectedReturn.reason}</p>
                                        <p className="text-xs text-gray-500 italic mt-1 font-medium">"{selectedReturn.comment}"</p>
                                    </div>
                                    {selectedReturn.googleDriveLink && (
                                        <div className="pt-2">
                                            <a
                                                href={selectedReturn.googleDriveLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 text-xs font-bold text-primary-700 bg-primary-50 border border-primary-200 px-3 py-2 rounded-lg hover:bg-primary-100 transition-all break-all"
                                            >
                                                Open Google Proof Link
                                            </a>
                                        </div>
                                    )}
                                    {((selectedReturn.proofMedia && selectedReturn.proofMedia.length > 0) ||
                                        (selectedReturn.images && selectedReturn.images.length > 0)) && (
                                        <div className="flex gap-2 pt-2 flex-wrap">
                                            {(selectedReturn.proofMedia || selectedReturn.images || []).map((media, i) => {
                                                const isVideo = isVideoUrl(media);
                                                if (isVideo) {
                                                    return (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setSelectedProof(media)}
                                                            className="relative w-24 h-24 rounded-xl overflow-hidden border border-white shadow-sm bg-black"
                                                        >
                                                            <video
                                                                src={media}
                                                                className="w-full h-full object-cover opacity-90"
                                                            />
                                                            <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-black bg-black/20">
                                                                VIEW
                                                            </span>
                                                        </button>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        key={i}
                                                        type="button"
                                                        onClick={() => setSelectedProof(media)}
                                                        className="w-16 h-16 rounded-xl overflow-hidden border border-white shadow-sm"
                                                    >
                                                        <img
                                                            src={media}
                                                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                                                            alt=""
                                                        />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-primary-50/50 p-4 rounded-2xl">
                                        <p className="text-[9px] font-black text-primary-400 uppercase mb-1">Order Ref</p>
                                        <p className="text-xs font-black text-primary-700">#{selectedReturn.orderDisplayId || selectedReturn.orderId}</p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl">
                                        <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Customer</p>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCustomerProfile(selectedReturn)}
                                            className="text-xs font-black text-primary-700 hover:text-primary-800 hover:underline transition-all cursor-pointer text-left"
                                            title="Open customer profile"
                                        >
                                            {selectedReturn.customer}
                                        </button>
                                    </div>
                                </div>

                                {selectedReturn.bankDetails && (
                                    <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
                                        <p className="text-[9px] font-black text-emerald-500 uppercase mb-2 tracking-widest">
                                            Refund Bank Details
                                        </p>
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-gray-700">
                                                <span className="font-black text-gray-900">Name:</span> {selectedReturn.bankDetails.accountHolderName || '-'}
                                            </p>
                                            <p className="text-xs text-gray-700">
                                                <span className="font-black text-gray-900">Account:</span> {selectedReturn.bankDetails.accountNumber || '-'}
                                            </p>
                                            <p className="text-xs text-gray-700">
                                                <span className="font-black text-gray-900">IFSC:</span> {selectedReturn.bankDetails.ifscCode || '-'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {selectedReturn.pickupAddress && (
                                    <div className="bg-primary-50/60 p-4 rounded-2xl border border-primary-100">
                                        <p className="text-[9px] font-black text-primary-500 uppercase mb-2 tracking-widest">
                                            Pickup Address
                                        </p>
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-gray-700">
                                                <span className="font-black text-gray-900">Name:</span> {selectedReturn.pickupAddress.name || '-'}
                                            </p>
                                            <p className="text-xs text-gray-700">
                                                <span className="font-black text-gray-900">Phone:</span> {selectedReturn.pickupAddress.phone || '-'}
                                            </p>
                                            <p className="text-xs text-gray-700">
                                                <span className="font-black text-gray-900">Type:</span> {selectedReturn.pickupAddress.type || '-'}
                                            </p>
                                            <p className="text-xs text-gray-700 leading-relaxed">
                                                <span className="font-black text-gray-900">Address:</span> {selectedReturn.pickupAddress.address || '-'}
                                                {selectedReturn.pickupAddress.city ? `, ${selectedReturn.pickupAddress.city}` : ''}
                                                {selectedReturn.pickupAddress.state ? `, ${selectedReturn.pickupAddress.state}` : ''}
                                                {selectedReturn.pickupAddress.pincode ? ` - ${selectedReturn.pickupAddress.pincode}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Side: Timeline & Actions */}
                        <div className="md:w-1/2 flex flex-col bg-gray-50 overflow-hidden">
                            <div className="flex items-center justify-between p-6 bg-white border-b border-gray-100">
                                <h2 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2">
                                    <MdHistory className="text-primary-600" size={20} /> Lifecycle Tracking
                                </h2>
                                <button onClick={() => setSelectedReturn(null)} className="hidden md:block p-2 hover:bg-gray-100 rounded-full text-gray-400"><MdCancel size={24} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                                {(() => {
                                    const baseSteps = getLifecycleStepsForRequest(selectedReturn);
                                    const lifecycleSteps = baseSteps.includes(selectedReturn.status)
                                        ? baseSteps
                                        : [...baseSteps, selectedReturn.status];
                                    const timelineEvents = Array.isArray(selectedReturn.timeline) ? selectedReturn.timeline : [];
                                    const currentIndex = lifecycleSteps.indexOf(selectedReturn.status);
                                    const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex;
                                    const progressHeight = lifecycleSteps.length > 1
                                        ? `${(safeCurrentIndex / (lifecycleSteps.length - 1)) * 100}%`
                                        : '0%';

                                    return (
                                        <div className="relative pb-4">
                                            <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-primary-200 pointer-events-none"></div>
                                            <div
                                                className="absolute left-[15px] top-0 w-0.5 bg-primary-600 pointer-events-none transition-all duration-300"
                                                style={{ height: progressHeight }}
                                            ></div>

                                            {lifecycleSteps.map((step, idx) => {
                                                const event = [...timelineEvents].reverse().find((entry) => entry.status === step);
                                                const isCompleted = idx <= safeCurrentIndex;
                                                const isCurrent = idx === safeCurrentIndex;
                                                const stepLabel = getDisplayStatusLabel(selectedReturn.type, step, selectedReturn);
                                                return (
                                                    <div key={`${selectedReturn.id}-${step}`} className="relative flex gap-6 mb-8 last:mb-0">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 text-white transition-all ${isCompleted ? 'bg-primary-600 shadow-lg shadow-primary-100' : 'bg-gray-300'}`}>
                                                            {isCompleted ? <MdCheckCircle size={16} /> : <MdPendingActions size={16} />}
                                                        </div>
                                                        <div className={`flex-1 bg-white p-4 rounded-2xl shadow-sm border transition-all ${isCurrent ? 'border-primary-200' : 'border-gray-100'}`}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-black text-gray-900 uppercase tracking-widest">{stepLabel}</span>
                                                                <span className="text-[9px] text-gray-900 font-bold">
                                                                    {event?.time ? formatLifecycleTime(event.time) : '--'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Action Footer */}
                            {selectedReturn.status !== 'Completed' && selectedReturn.status !== 'Rejected' && (
                                <div className="p-6 bg-white border-t border-gray-200 space-y-4">
                                    {selectedReturn.status === 'Pending' ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handleStatusUpdate(selectedReturn._id, 'Approved')}
                                                className="py-3 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-100"
                                            >
                                                {selectedReturn.type === 'Cancellation' ? 'Approve Cancellation' : 'Accept Request'}
                                            </button>
                                            <button
                                                onClick={() => handleRejectWithReason(selectedReturn._id)}
                                                className="py-3 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-600 hover:text-white transition"
                                            >
                                                {selectedReturn.type === 'Cancellation' ? 'Reject Cancellation' : 'Reject Request'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                                            <select
                                                value={nextStatus}
                                                onChange={(e) => setNextStatus(e.target.value)}
                                                className="w-full bg-gray-50 border-2 border-transparent focus:border-primary-500 rounded-xl px-4 py-3 outline-none text-xs font-black text-gray-900"
                                            >
                                                <option value="" disabled>Select next status</option>
                                                {getStatusOptions(selectedReturn).map((status) => (
                                                    <option key={status} value={status}>
                                                        {getDisplayStatusLabel(selectedReturn.type, status, selectedReturn)}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => handleStatusUpdate(selectedReturn._id, nextStatus)}
                                                disabled={!nextStatus}
                                                className="py-3 px-5 bg-primary-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary-700 transition shadow-lg shadow-primary-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                            >
                                                {getActionLabel(nextStatus, selectedReturn.type, selectedReturn)}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedProof && (
                <div
                    className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedProof(null)}
                >
                    <button
                        type="button"
                        className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2"
                        onClick={() => setSelectedProof(null)}
                    >
                        <MdCancel size={26} />
                    </button>
                    <div
                        className="max-w-5xl max-h-[88vh] w-full flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {isVideoUrl(selectedProof) ? (
                            <video
                                src={selectedProof}
                                controls
                                autoPlay
                                className="max-w-full max-h-[88vh] rounded-xl bg-black"
                            />
                        ) : (
                            <img
                                src={selectedProof}
                                alt="Proof Preview"
                                className="max-w-full max-h-[88vh] rounded-xl object-contain"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReturnRequests;
