import React, { useEffect, useState } from 'react';
import {
    MdNotifications,
    MdDelete,
    MdFilterList,
    MdSend,
    MdPeopleAlt,
    MdHistory,
    MdCheckCircle
} from 'react-icons/md';
import useNotificationStore from '../../store/notificationStore';
import { confirmToast } from '../../../../utils/toastUtils.jsx';
import toast from 'react-hot-toast';
import { AdminTableHead, AdminTableHeaderCell, AdminTableHeaderRow } from '../../components/common/AdminTable';
import Pagination from '../../../../components/Pagination';

const NotificationManager = () => {
    const {
        filteredPushNotifications,
        addPushNotification,
        deletePushNotification,
        filterPushNotifications,
        fetchNotifications,
        isLoading
    } = useNotificationStore();

    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'General',
        targetAudience: 'Active Users'
    });
    const [filters, setFilters] = useState({
        type: 'All',
        target: 'All'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;
    const notificationTypes = ['General', 'Promotional', 'Order Update', 'New Arrival'];
    const targetAudiences = ['New Users', 'Active Users', 'Inactive Users'];

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        const nextFilters = { ...filters, [name]: value };
        setFilters(nextFilters);
        setCurrentPage(1);
        filterPushNotifications(nextFilters.type, nextFilters.target);
    };

    const resetForm = () => {
        setFormData({
            title: '',
            message: '',
            type: 'General',
            targetAudience: 'Active Users'
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.title.trim() || !formData.message.trim()) {
            toast.error('Please fill in both title and message');
            return;
        }

        try {
            const result = await addPushNotification({
                ...formData,
                title: formData.title.trim(),
                message: formData.message.trim()
            });

            if (result.firebaseSent) {
                toast.success(`Notification sent to ${result.tokensTargeted} users`);
            } else {
                const firstFailure = result?.failureReasons?.[0];
                const reasonText = firstFailure?.code
                    ? `${firstFailure.code}${firstFailure.message ? `: ${firstFailure.message}` : ''}`
                    : 'No detailed reason from backend';
                toast(`Notification saved but not delivered (${result.tokensTargeted} tokens targeted)`, {
                    icon: '!',
                    style: {
                        background: '#FEF3C7',
                        color: '#92400E'
                    },
                    duration: 7000
                });
                toast.error(`Send failed reason: ${reasonText}`, { duration: 9000 });
            }

            resetForm();
        } catch (error) {
            if (error.response?.status === 401) {
                toast.error('Admin session expired. Please log in again.');
                return;
            }

            toast.error(`Failed to send notification: ${error.response?.data?.message || error.message || 'Unknown error'}`);
        }
    };

    const handleDelete = (id) => {
        confirmToast({
            message: 'Are you sure you want to delete this notification record?',
            type: 'danger',
            confirmText: 'Delete',
            onConfirm: () => {
                deletePushNotification(id);
                toast.success('Notification deleted');
            }
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Sent':
            case 'sent':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'Failed':
            case 'failed':
                return 'bg-red-100 text-red-700 border-red-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'Promotional':
            case 'promotional':
                return 'bg-primary-100 text-primary-700 border-primary-200';
            case 'Order Update':
            case 'order':
                return 'bg-sky-100 text-sky-700 border-sky-200';
            case 'New Arrival':
                return 'bg-orange-100 text-orange-700 border-orange-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getAudienceDisplay = (audience) => {
        return audience || 'N/A';
    };

    const formatNotificationDate = (value) => {
        if (!value) {
            return 'N/A';
        }

        return new Date(value).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const totalPages = Math.max(1, Math.ceil(filteredPushNotifications.length / itemsPerPage));
    const paginatedNotifications = filteredPushNotifications.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-100 text-primary-600 rounded-xl">
                        <MdNotifications size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">User Notifications</h1>
                        <p className="text-sm text-gray-500 font-medium">Send push notifications from one simple form.</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 border-b border-gray-50 pb-4 mb-6">
                    <span className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                        <MdSend size={18} />
                    </span>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Send Push Notification</h2>
                        <p className="text-sm text-gray-500">No extra test button. Just fill this form and send.</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Notification Title</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                placeholder="e.g. Flash Sale Alert"
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white outline-none transition-all font-bold text-gray-900 placeholder:text-gray-400"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Notification Type</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleInputChange}
                                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white outline-none transition-all font-bold text-gray-900"
                            >
                                {notificationTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Message Content</label>
                        <textarea
                            name="message"
                            value={formData.message}
                            onChange={handleInputChange}
                            placeholder="Write your notification message here..."
                            rows="4"
                            className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white outline-none transition-all font-bold text-gray-900 placeholder:text-gray-400 resize-none"
                            maxLength="200"
                            required
                        />
                        <p className="text-[10px] text-gray-400 text-right font-medium">Max 200 characters recommended for best delivery</p>
                    </div>

                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg text-primary-500 shadow-sm">
                                <MdPeopleAlt size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-700">Audience</p>
                                <p className="text-xs text-gray-500">Choose who should receive this push notification.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {targetAudiences.map((target) => (
                                <button
                                    key={target}
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, targetAudience: target }))}
                                    className={`px-4 py-3 rounded-xl text-sm font-bold transition-all border ${formData.targetAudience === target
                                        ? 'bg-primary-600 text-white border-primary-600 shadow-md'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                                    }`}
                                >
                                    {target}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                        <p className="text-sm text-gray-500">
                            Selected audience: <span className="font-semibold text-gray-700">{formData.targetAudience}</span>
                        </p>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-black tracking-wide transition-all ${isLoading
                                ? 'bg-primary-300 text-white cursor-not-allowed'
                                : 'bg-primary-600 text-white hover:bg-primary-700 shadow-xl shadow-primary-100'
                            }`}
                        >
                            <MdSend size={20} />
                            {isLoading ? 'Sending...' : 'Send Push Notification'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <MdHistory className="text-gray-400" size={20} />
                        <h3 className="font-bold text-gray-700">Notification History</h3>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                            <MdFilterList className="text-gray-400" size={16} />
                            <select
                                name="type"
                                value={filters.type}
                                onChange={handleFilterChange}
                                className="text-[10px] font-black uppercase tracking-widest text-gray-600 outline-none bg-transparent"
                            >
                                <option value="All">All Types</option>
                                {notificationTypes.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-sm">
                            <MdPeopleAlt className="text-gray-400" size={16} />
                            <select
                                name="target"
                                value={filters.target}
                                onChange={handleFilterChange}
                                className="text-[10px] font-black uppercase tracking-widest text-gray-600 outline-none bg-transparent"
                            >
                                <option value="All">All Audiences</option>
                                {targetAudiences.map((audience) => (
                                    <option key={audience} value={audience}>{audience}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <AdminTableHead className="bg-slate-900">
                            <AdminTableHeaderRow className="bg-transparent border-b-0">
                                <AdminTableHeaderCell>S.No</AdminTableHeaderCell>
                                <AdminTableHeaderCell>Title and Message</AdminTableHeaderCell>
                                <AdminTableHeaderCell className="text-center">Type</AdminTableHeaderCell>
                                <AdminTableHeaderCell className="text-center">Audience</AdminTableHeaderCell>
                                <AdminTableHeaderCell className="text-center">Status</AdminTableHeaderCell>
                                <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
                            </AdminTableHeaderRow>
                        </AdminTableHead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredPushNotifications.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">
                                        No notifications found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                paginatedNotifications.map((notif, index) => (
                                    <tr key={notif._id || notif.id} className="hover:bg-primary-50/5 transition-colors group">
                                        <td className="px-5 py-3 font-bold text-gray-400 text-sm">#{((currentPage - 1) * itemsPerPage) + index + 1}</td>
                                        <td className="px-5 py-3 max-w-md">
                                            <p className="font-bold text-gray-800 text-sm">{notif.title}</p>
                                            <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{notif.message}</p>
                                            <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase">{formatNotificationDate(notif.sentAt || notif.createdAt)}</p>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getTypeColor(notif.type)}`}>
                                                {notif.type}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <div className="flex items-start justify-center gap-1.5 text-xs font-bold text-gray-600">
                                                <MdPeopleAlt size={14} className="text-gray-400" />
                                                <span className="max-w-[320px] whitespace-normal break-words text-left">{getAudienceDisplay(notif.targetAudience)}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${getStatusColor(notif.status)}`}>
                                                    {(notif.status === 'Sent' || notif.status === 'sent') && <MdCheckCircle size={12} />}
                                                    {notif.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(notif._id || notif.id)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Delete Record"
                                            >
                                                <MdDelete size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {filteredPushNotifications.length > itemsPerPage && (
                <Pagination
                    page={currentPage}
                    pages={totalPages}
                    changePage={handlePageChange}
                />
            )}
        </div>
    );
};

export default NotificationManager;
