import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdNotifications, MdLogout, MdPerson, MdCheckCircle, MdError, MdInfo, MdClose } from 'react-icons/md';
import useAdminAuthStore from '../../store/adminAuthStore';
import useNotificationStore from '../../store/notificationStore';
import logo from '../../../../assets/jaipurio-logo.jpeg';

const AdminHeader = () => {
    const navigate = useNavigate();
    const { adminUser, logout } = useAdminAuthStore();
    const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, playSound } = useNotificationStore();
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef(null);

    // Initial Fetch and Polling
    useEffect(() => {
        fetchNotifications();

        // Poll every 30 seconds
        const interval = setInterval(() => {
            fetchNotifications().then(() => {
                // Check if unreadCount increased? 
                // The store updates state. We can track previous count in a ref here to play sound
            });
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    // Effect to play sound when unread count increases
    const prevUnreadCountRef = useRef(0);
    useEffect(() => {
        if (unreadCount > prevUnreadCountRef.current) {
            playSound();
        }
        prevUnreadCountRef.current = unreadCount;
    }, [unreadCount]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'order': return <MdCheckCircle className="text-green-500" size={20} />;
            case 'return': return <MdInfo className="text-primary-500" size={20} />;
            case 'stock': return <MdError className="text-red-500" size={20} />;
            default: return <MdNotifications className="text-gray-500" size={20} />;
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <header className="h-16 md:h-20 bg-gray-900 border-b border-gray-800 flex items-center justify-between pl-14 pr-6 lg:px-6 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-opacity-95">
            <div className="flex items-center gap-2 md:gap-4">
                <img src={logo} alt="Logo" className="w-14 h-14 object-contain md:hidden" />
                <h2 className="text-base md:text-2xl font-black text-white tracking-tight italic">
                    ADMIN <span className="text-primary-500 not-italic">DASHBOARD</span>
                </h2>
            </div>

            <div className="flex items-center gap-1 md:gap-4">
                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        className="relative p-2 hover:bg-gray-800 rounded-xl transition-all duration-300 group"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <MdNotifications size={28} className={`group-hover:text-primary-500 ${unreadCount > 0 ? 'text-white' : 'text-gray-400'}`} />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-900 animate-pulse"></span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-800">Notifications</h3>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="text-xs text-primary-600 font-bold hover:text-primary-700 hover:underline"
                                    >
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[400px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        <MdNotifications size={48} className="mx-auto mb-2 text-gray-200" />
                                        <p className="text-sm">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map(notification => (
                                        <div
                                            key={notification._id}
                                            className={`p-4 border-b last:border-0 hover:bg-gray-50 transition-colors cursor-pointer ${notification.isRead ? 'opacity-60' : 'bg-primary-50/50'}`}
                                            onClick={() => markAsRead(notification._id)}
                                        >
                                            <div className="flex gap-3">
                                                <div className="mt-1">
                                                    {getNotificationIcon(notification.type)}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className={`text-sm ${notification.isRead ? 'font-medium text-gray-700' : 'font-bold text-gray-900'}`}>
                                                        {notification.title}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                    <span className="text-[10px] text-gray-400 mt-2 block">
                                                        {new Date(notification.createdAt).toLocaleDateString()} • {formatTime(notification.createdAt)}
                                                    </span>
                                                </div>
                                                {!notification.isRead && (
                                                    <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Admin Profile */}
                <div className="flex items-center gap-2 pl-2 border-l border-gray-800">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm md:text-base font-black text-gray-100 leading-none">{adminUser?.name || 'Super Admin'}</p>
                        <p className="text-xs md:text-sm text-primary-500 font-bold uppercase tracking-widest mt-1">Full Access</p>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-900/20 border border-primary-400/20">
                        <MdPerson size={28} className="text-white" />
                    </div>
                </div>

                {/* Logout */}
                <button
                    onClick={handleLogout}
                    className="p-2.5 bg-gray-800/50 hover:bg-red-500 text-gray-400 hover:text-white rounded-xl transition-all duration-300 shadow-inner"
                    title="Logout"
                >
                    <MdLogout size={28} />
                </button>
            </div>
        </header>
    );
};

export default AdminHeader;
