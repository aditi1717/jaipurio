import React, { useState, useEffect, useMemo } from 'react';
import API from '../../../../services/api';
import { MdStore, MdCheck, MdClose, MdLocationOn, MdInfo } from 'react-icons/md';
import toast from 'react-hot-toast';
import Pagination from '../../components/common/Pagination';

const SellerRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const isReviewLocked = selectedRequest && selectedRequest.status !== 'Pending';
    const itemsPerPage = 8;

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const { data } = await API.get('/seller-requests');
            setRequests(data);
        } catch (err) {
            toast.error('Failed to fetch seller requests');
        } finally {
            setLoading(false);
        }
    };

    const sortedRequests = useMemo(
        () => [...requests].sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)),
        [requests]
    );

    const totalPages = Math.max(1, Math.ceil(sortedRequests.length / itemsPerPage));

    const paginatedRequests = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedRequests.slice(start, start + itemsPerPage);
    }, [sortedRequests, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const handleUpdateStatus = async (id, status) => {
        try {
            await API.put(`/seller-requests/${id}`, { status, adminNotes });
            toast.success(`Request ${status.toLowerCase()} successfully`);
            fetchRequests();
            setSelectedRequest(null);
            setAdminNotes('');
        } catch (err) {
            toast.error('Failed to update request');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-4 md:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-8 mb-4 md:mb-8">
                <div>
                    <h1 className="text-xl md:text-2xl font-black text-gray-900">Seller Requests</h1>
                    <p className="text-xs md:text-sm text-gray-500 font-medium">Manage and review merchant applications</p>
                </div>
                <div className="bg-primary-50 text-primary-600 px-3 py-1.5 md:px-4 md:py-2 rounded-xl font-bold text-xs md:text-sm border border-primary-100 uppercase tracking-wider w-fit">
                    {requests.length} Total Requests
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-900 border-b border-slate-800">
                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white">Store</th>
                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white">Email</th>
                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white">Phone</th>
                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white">GST</th>
                                <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white">Status</th>
                                <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-white">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {paginatedRequests.map((request) => (
                                <tr key={request._id} className="hover:bg-gray-50/70 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                                <MdStore className="text-lg text-gray-500" />
                                            </div>
                                            <span className="font-bold text-gray-900 truncate">{request.storeName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{request.businessEmail}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-700">{request.phoneNumber}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-primary-700">{request.taxId}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${request.status === 'Pending'
                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                : request.status === 'Approved'
                                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                                    : 'bg-red-50 text-red-700 border border-red-200'
                                            }`}>
                                            {request.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => {
                                                setSelectedRequest(request);
                                                setAdminNotes(request.adminNotes || '');
                                            }}
                                            className="bg-gray-900 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-gray-800 transition-colors"
                                        >
                                            Review
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {requests.length === 0 && (
                    <div className="text-center py-16 bg-gray-50 border-t border-gray-100">
                        <MdStore className="text-4xl text-gray-300 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-gray-500 italic">No seller requests yet</h3>
                    </div>
                )}

                {requests.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>

            {/* Review Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedRequest(null)}></div>
                    <div className="bg-white text-gray-900 w-full max-w-xl rounded-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 border border-gray-200">
                        <div className="p-4 md:p-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg md:text-xl font-black text-gray-900">Review Application</h2>
                                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-0.5">{selectedRequest.storeName}</p>
                                {selectedRequest.status !== 'Pending' && (
                                    <div className={`inline-flex mt-2 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedRequest.status === 'Approved'
                                            ? 'bg-green-50 text-green-700 border border-green-200'
                                            : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}>
                                        {selectedRequest.status}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                                <MdClose size={20} className="md:w-[22px] md:h-[22px]" />
                            </button>
                        </div>

                        <div className="p-4 md:p-5 space-y-4 max-h-[68vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Business Type</h4>
                                    <p className="font-bold text-gray-900 flex items-center gap-2"><MdInfo className="text-primary-600" /> {selectedRequest.businessType}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Registration ID</h4>
                                    <p className="font-bold text-gray-900 flex items-center gap-2"><MdInfo className="text-primary-600" /> {selectedRequest.taxId}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Business Address</h4>
                                <p className="font-medium text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-start gap-2">
                                    <MdLocationOn className="text-primary-600 text-lg shrink-0 mt-0.5" />
                                    {selectedRequest.businessAddress}
                                </p>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Business Description</h4>
                                <div className="font-medium text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                    {selectedRequest.description}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Admin Notes (Optional)</h4>
                                <textarea
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    readOnly={isReviewLocked}
                                    placeholder={isReviewLocked ? 'No admin notes added.' : 'Add feedback for the seller...'}
                                    className={`w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none font-medium text-gray-800 transition-all min-h-[90px] placeholder:text-gray-500 ${isReviewLocked ? 'cursor-default' : 'focus:border-primary-500'}`}
                                ></textarea>
                            </div>
                        </div>

                        {selectedRequest.status === 'Pending' ? (
                            <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => handleUpdateStatus(selectedRequest._id, 'Rejected')}
                                    className="px-4 py-2 rounded-xl border border-red-200 text-red-700 font-black text-xs md:text-sm hover:bg-red-50 transition-all flex items-center gap-1.5"
                                >
                                    <MdClose /> Reject Request
                                </button>
                                <button
                                    onClick={() => handleUpdateStatus(selectedRequest._id, 'Approved')}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs md:text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/40 flex items-center gap-1.5"
                                >
                                    <MdCheck /> Approve Seller
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 md:p-5 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
                                <div className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider ${selectedRequest.status === 'Approved'
                                        ? 'bg-green-50 text-green-700 border border-green-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    Request {selectedRequest.status}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SellerRequests;
