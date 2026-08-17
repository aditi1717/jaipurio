import React, { useEffect, useState } from 'react';
import { MdNotifications, MdCheckCircle, MdInfo, MdError, MdDelete } from 'react-icons/md';
import useNotificationStore from '../../store/notificationStore';
import Pagination from '../../../../components/Pagination';
import { AdminTableHead, AdminTableHeaderCell, AdminTableHeaderRow } from '../../components/common/AdminTable';
import { confirmToast } from '../../../../utils/toastUtils.jsx';
import toast from 'react-hot-toast';

const AdminNotifications = () => {
    const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, deleteAllNotifications } = useNotificationStore();
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'order':
                return <MdCheckCircle className="text-green-600" size={16} />;
            case 'return':
                return <MdInfo className="text-primary-600" size={16} />;
            case 'stock':
                return <MdError className="text-red-600" size={16} />;
            default:
                return <MdNotifications className="text-gray-600" size={16} />;
        }
    };

    const getTypeBadgeClass = (type) => {
        switch (type) {
            case 'order':
                return 'bg-green-50 text-green-700 border-green-200';
            case 'return':
                return 'bg-primary-50 text-primary-700 border-primary-200';
            case 'stock':
                return 'bg-red-50 text-red-700 border-red-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const formatDateTime = (value) => {
        if (!value) return 'N/A';
        return new Date(value).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const totalPages = Math.max(1, Math.ceil(notifications.length / itemsPerPage));
    const paginatedNotifications = notifications.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleDeleteAll = () => {
        confirmToast({
            message: 'Delete all admin notifications?',
            type: 'danger',
            confirmText: 'Delete All',
            onConfirm: async () => {
                try {
                    await deleteAllNotifications();
                    setCurrentPage(1);
                    toast.success('All notifications deleted');
                } catch (error) {
                    toast.error('Failed to delete notifications');
                }
            }
        });
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-100 text-gray-800 rounded-xl">
                        <MdNotifications size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Admin Notifications</h1>
                        <p className="text-sm text-gray-500 font-medium">Notifications received by the admin panel</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="px-5 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-black transition"
                        >
                            Mark All Read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            onClick={handleDeleteAll}
                            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition"
                        >
                            <MdDelete size={18} />
                            Delete All
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <AdminTableHead className="bg-slate-900">
                            <AdminTableHeaderRow className="bg-transparent border-b-0">
                                <AdminTableHeaderCell compact>S.No</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact>Notification</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-center">Type</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-center">Status</AdminTableHeaderCell>
                                <AdminTableHeaderCell compact className="text-right">Date</AdminTableHeaderCell>
                            </AdminTableHeaderRow>
                        </AdminTableHead>
                        <tbody className="divide-y divide-gray-200">
                            {paginatedNotifications.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">
                                        No admin notifications available.
                                    </td>
                                </tr>
                            ) : (
                                paginatedNotifications.map((notification, index) => (
                                    <tr
                                        key={notification._id}
                                        className={`transition-colors hover:bg-gray-50 ${notification.isRead ? 'bg-white' : 'bg-primary-50/30'}`}
                                        onClick={() => {
                                            if (!notification.isRead) {
                                                markAsRead(notification._id);
                                            }
                                        }}
                                    >
                                        <td className="px-5 py-3 text-sm font-bold text-gray-400">
                                            #{((currentPage - 1) * itemsPerPage) + index + 1}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900">{notification.title}</p>
                                                    <p className="mt-1 text-xs text-gray-500">{notification.message}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getTypeBadgeClass(notification.type)}`}>
                                                {notification.type || 'general'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${notification.isRead ? 'bg-gray-100 text-gray-600' : 'bg-primary-100 text-primary-700'}`}>
                                                {notification.isRead ? 'Read' : 'Unread'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right text-sm font-semibold text-gray-600">
                                            {formatDateTime(notification.createdAt)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {notifications.length > itemsPerPage && (
                <Pagination
                    page={currentPage}
                    pages={totalPages}
                    changePage={handlePageChange}
                />
            )}
        </div>
    );
};

export default AdminNotifications;
