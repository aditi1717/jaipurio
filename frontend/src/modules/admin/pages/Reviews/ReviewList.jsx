import React, { useState, useEffect } from 'react';
import { MdSearch, MdFilterList, MdCheckCircle, MdCancel, MdStar, MdRateReview } from 'react-icons/md';
import toast from 'react-hot-toast';
import API from '../../../../services/api';
import AdminTable, { AdminTableHead, AdminTableHeaderCell, AdminTableHeaderRow } from '../../components/common/AdminTable';
import { matchesNormalizedSearch } from '../../utils/search';

const ReviewList = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [updatingId, setUpdatingId] = useState(null);

    const fetchReviews = async () => {
        try {
            setLoading(true);
            const { data } = await API.get('/reviews');
            setReviews(data);
        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews();
    }, []);

    const handleUpdateStatus = async (id, status) => {
        try {
            setUpdatingId(id);
            await API.patch(`/reviews/${id}/status`, { status });
            // Update local state
            setReviews(prev => prev.map(r => r._id === id ? { ...r, status } : r));
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredReviews = reviews.filter(rev => {
        const matchesSearch =
            matchesNormalizedSearch(rev.product?.name, searchTerm) ||
            matchesNormalizedSearch(rev.user?.name, searchTerm) ||
            matchesNormalizedSearch(rev.comment, searchTerm);

        const matchesStatus = statusFilter === 'All' || rev.status === statusFilter.toLowerCase();

        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
            case 'approved': return 'bg-green-50 text-green-600 border-green-100';
            case 'rejected': return 'bg-red-50 text-red-600 border-red-100';
            default: return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">Customer Reviews</h1>
                    <p className="text-sm text-gray-500 font-medium italic">Latest customer reviews across the store ({filteredReviews.length} shown)</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full">
                    <MdSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search product, user, or comment..."
                        className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:border-primary-500 outline-none transition-all text-sm text-gray-900 placeholder:text-gray-900 font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <MdFilterList className="text-gray-400" size={20} />
                    <select
                        className="px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-primary-500 text-sm font-black text-gray-900 min-w-[150px] appearance-none"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="All">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <AdminTable shellClassName="border-gray-100">
                        <AdminTableHead>
                            <AdminTableHeaderRow>
                                <AdminTableHeaderCell>Product</AdminTableHeaderCell>
                                <AdminTableHeaderCell>User</AdminTableHeaderCell>
                                <AdminTableHeaderCell>Rating</AdminTableHeaderCell>
                                <AdminTableHeaderCell>Comment</AdminTableHeaderCell>
                                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                                <AdminTableHeaderCell className="text-center">Actions</AdminTableHeaderCell>
                            </AdminTableHeaderRow>
                        </AdminTableHead>
                        <tbody className="divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400">Loading reviews...</td>
                                </tr>
                            ) : filteredReviews.length > 0 ? (
                                filteredReviews.map((rev) => (
                                    <tr key={rev._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                                    <img src={rev.product?.image} alt="" className="w-full h-full object-contain" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate max-w-[150px]">{rev.product?.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-medium font-mono uppercase">ID: {rev.product?.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <p className="text-sm font-bold text-gray-900">{rev.user?.name}</p>
                                            <p className="text-[11px] text-gray-500">{rev.user?.email}</p>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-2 py-1 rounded-lg w-fit border border-amber-100">
                                                <span className="text-sm font-black">{rev.rating}</span>
                                                <MdStar size={16} />
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <p className="text-sm text-gray-600 font-medium max-w-xs line-clamp-2">{rev.comment}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{new Date(rev.createdAt).toLocaleString()}</p>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusStyle(rev.status)}`}>
                                                {rev.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                {rev.status === 'pending' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleUpdateStatus(rev._id, 'approved')}
                                                            disabled={updatingId === rev._id}
                                                            className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm border border-green-100"
                                                            title="Approve"
                                                        >
                                                            <MdCheckCircle size={20} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateStatus(rev._id, 'rejected')}
                                                            disabled={updatingId === rev._id}
                                                            className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100"
                                                            title="Reject"
                                                        >
                                                            <MdCancel size={20} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleUpdateStatus(rev._id, 'pending')}
                                                        disabled={updatingId === rev._id}
                                                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase hover:bg-gray-200 transition-all font-mono"
                                                    >
                                                        Reset to Pending
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2 text-gray-400">
                                            <MdRateReview size={48} className="opacity-20" />
                                            <p className="font-medium italic">No reviews found matching your criteria</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
            </AdminTable>
        </div>
    );
};

export default ReviewList;
