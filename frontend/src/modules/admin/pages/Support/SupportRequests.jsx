import React, { useState } from 'react';
import useSupportStore from '../../store/supportStore';
import { MdSearch, MdDelete, MdCheckCircle, MdPending, MdAccessTime, MdFilterList } from 'react-icons/md';
import { AdminTableHead, AdminTableHeaderCell, AdminTableHeaderRow } from '../../components/common/AdminTable';
import { matchesNormalizedSearch } from '../../utils/search';

const SupportRequests = () => {
    const { supportRequests, updateStatus, deleteRequest } = useSupportStore();
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRequests = supportRequests.filter(req => {
        const matchesStatus = filterStatus === 'ALL' || req.status === filterStatus;
        const matchesSearch =
            matchesNormalizedSearch(req.id, searchQuery) ||
            matchesNormalizedSearch(req.customerName, searchQuery) ||
            matchesNormalizedSearch(req.contact, searchQuery);
        return matchesStatus && matchesSearch;
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'OPEN': return 'bg-red-100 text-red-600';
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-700';
            case 'RESOLVED': return 'bg-green-100 text-green-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Support Requests</h1>

                <div className="flex gap-3">
                    <div className="relative">
                        <MdSearch className="absolute left-3 top-3 text-gray-400 text-lg" />
                        <input
                            type="text"
                            placeholder="Search requests..."
                            className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:border-primary-500 w-64"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="relative">
                        <select
                            className="appearance-none bg-white border px-4 py-2 pr-8 rounded-lg outline-none focus:border-primary-500 cursor-pointer"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="ALL">All Status</option>
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="RESOLVED">Resolved</option>
                        </select>
                        <MdFilterList className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-primary-500">
                    <p className="text-gray-500 text-sm font-medium uppercase">Total Requests</p>
                    <p className="text-2xl font-bold text-gray-800">{supportRequests.length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-red-500">
                    <p className="text-gray-500 text-sm font-medium uppercase">Open</p>
                    <p className="text-2xl font-bold text-gray-800">{supportRequests.filter(r => r.status === 'OPEN').length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-yellow-500">
                    <p className="text-gray-500 text-sm font-medium uppercase">In Progress</p>
                    <p className="text-2xl font-bold text-gray-800">{supportRequests.filter(r => r.status === 'IN_PROGRESS').length}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border border-l-4 border-l-green-500">
                    <p className="text-gray-500 text-sm font-medium uppercase">Resolved</p>
                    <p className="text-2xl font-bold text-gray-800">{supportRequests.filter(r => r.status === 'RESOLVED').length}</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                    <AdminTableHead>
                        <AdminTableHeaderRow>
                            <AdminTableHeaderCell>ID / Date</AdminTableHeaderCell>
                            <AdminTableHeaderCell>Customer</AdminTableHeaderCell>
                            <AdminTableHeaderCell>Issue</AdminTableHeaderCell>
                            <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                            <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
                        </AdminTableHeaderRow>
                    </AdminTableHead>
                    <tbody className="divide-y divide-gray-200">
                        {paginatedRequests.length > 0 ? (
                            paginatedRequests.map((req) => (
                                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="font-bold text-gray-800 text-sm">#{req.id}</div>
                                        <div className="text-xs text-gray-400 mt-1">{new Date(req.date).toLocaleDateString()}</div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="font-medium text-gray-800">{req.customerName}</div>
                                        <div className="text-xs text-primary-600 mt-1">{req.contact}</div>
                                    </td>
                                    <td className="px-5 py-3 max-w-xs">
                                        <div className="text-xs font-bold text-gray-500 uppercase mb-1">{req.category}</div>
                                        <p className="text-sm text-gray-600 line-clamp-2" title={req.description}>{req.description}</p>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(req.status)}`}>
                                            {req.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            {req.status !== 'RESOLVED' && (
                                                <button
                                                    onClick={() => updateStatus(req.id, 'RESOLVED')}
                                                    className="w-8 h-8 rounded-full bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-colors"
                                                    title="Mark Resolved"
                                                >
                                                    <MdCheckCircle />
                                                </button>
                                            )}
                                            {req.status === 'OPEN' && (
                                                <button
                                                    onClick={() => updateStatus(req.id, 'IN_PROGRESS')}
                                                    className="w-8 h-8 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center hover:bg-yellow-100 transition-colors"
                                                    title="Mark In Progress"
                                                >
                                                    <MdPending />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Delete this request?')) deleteRequest(req.id);
                                                }}
                                                className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
                                                title="Delete"
                                            >
                                                <MdDelete />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="px-6 py-12 text-center text-gray-400">
                                    <div className="flex flex-col items-center">
                                        <span className="material-icons text-4xl mb-2 text-gray-300">inbox</span>
                                        No requests found matching your filters.
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {
                totalPages > 1 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                )
            }
        </div >
    );
};

export default SupportRequests;
