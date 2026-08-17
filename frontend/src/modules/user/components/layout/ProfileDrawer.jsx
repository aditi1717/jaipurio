import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { MdClose } from 'react-icons/md';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';

// Import Page Components
import MyOrders from '../../pages/MyOrders';
import Wishlist from '../../pages/Wishlist';
import Addresses from '../../pages/Addresses';
import NotificationSettings from '../../pages/NotificationSettings';
import HelpCenter from '../../pages/HelpCenter';

const ProfileDrawer = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { userProfile, updateUserProfile } = useCartStore();
    const [isEditing, setIsEditing] = useState(false);
    const drawerRef = useRef(null);
    const [activeView, setActiveView] = useState('MENU'); // 'MENU', 'ORDERS', 'WISHLIST', etc.
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // Initial form data
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        email: '',
        gender: ''
    });

    useEffect(() => {
        if (user || userProfile) {
            setFormData({
                name: user?.name || userProfile?.name || '',
                mobile: user?.phone || userProfile?.mobile || '',
                email: user?.email || userProfile?.email || '',
                gender: userProfile?.gender || ''
            });
        }
    }, [user, userProfile]);

    const handleSave = () => {
        const trimmedName = String(formData.name || '').trim();
        const trimmedEmail = String(formData.email || '').trim().toLowerCase();
        if (!trimmedName) {
            toast.error('Full name is required');
            return;
        }
        if (/\d/.test(trimmedName)) {
            toast.error('Full name should not contain numbers');
            return;
        }
        if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
            toast.error('Please enter a valid email format');
            return;
        }

        updateUserProfile({ ...formData, name: trimmedName, email: trimmedEmail });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setFormData(userProfile);
        setIsEditing(false);
    };

    // Close drawer when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (drawerRef.current && !drawerRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Reset view when drawer closes
    useEffect(() => {
        if (!isOpen) {
            // Slight delay to allow animation to finish before resetting
            setTimeout(() => setActiveView('MENU'), 300);
        }
    }, [isOpen]);

    const handleBackToMenu = () => {
        setActiveView('MENU');
    };

    const renderContent = () => {
        switch (activeView) {
            case 'ORDERS':
                return <MyOrders onBack={handleBackToMenu} />;
            case 'WISHLIST':
                return <Wishlist onBack={handleBackToMenu} />;
            case 'ADDRESSES':
                return <Addresses onBack={handleBackToMenu} />;
            case 'NOTIFICATIONS':
                return <NotificationSettings onBack={handleBackToMenu} />;
            case 'HELP':
                return <HelpCenter onBack={handleBackToMenu} />;
            default:
                return renderMenu();
        }
    };

    const renderMenu = () => (
        <div className="flex-1 flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-primary-600 text-white">
                <h2 className="text-lg font-bold">My Profile</h2>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                    <MdClose className="text-xl" />
                </button>
            </div>

            {/* Profile Info Section */}
            <div className="p-4 border-b border-gray-100">
                {!isEditing ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white text-primary-600 flex items-center justify-center font-bold text-xl shadow-sm">
                                {(user?.name || userProfile?.name || 'U').charAt(0)}
                            </div>
                             <div>
                                <p className="font-bold text-gray-800">{user?.name || userProfile?.name || 'User'}</p>
                                {(user?.phone || userProfile?.mobile) && (
                                    <p className="text-xs text-gray-500">+91 {user?.phone || userProfile?.mobile}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:bg-primary-50 px-3 py-1.5 rounded transition-all"
                        >
                            Edit
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Full Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (/\d/.test(value)) return;
                                    setFormData({ ...formData, name: value });
                                }}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-primary-600 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Mobile</label>
                            <input
                                type="tel"
                                value={formData.mobile}
                                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-primary-600 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:border-primary-600 outline-none"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleCancel} className="flex-1 py-1.5 text-xs font-bold text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
                            <button onClick={handleSave} className="flex-1 py-1.5 text-xs font-bold text-white bg-primary-600 rounded hover:bg-primary-700 shadow-sm">Save</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Menu Options */}
            <div className="flex-1 overflow-y-auto">
                <div className="py-2">
                    <div onClick={() => setActiveView('ORDERS')} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors group">
                        <span className="material-icons-outlined text-primary-600 group-hover:scale-110 transition-transform">inventory_2</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600">My Orders</p>
                        </div>
                        <span className="material-icons-outlined text-gray-300">chevron_right</span>
                    </div>
                    <div onClick={() => setActiveView('WISHLIST')} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors group">
                        <span className="material-icons-outlined text-primary-600 group-hover:scale-110 transition-transform">favorite_border</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600">Wishlist</p>
                        </div>
                        <span className="material-icons-outlined text-gray-300">chevron_right</span>
                    </div>
                    <div onClick={() => setActiveView('ADDRESSES')} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors group">
                        <span className="material-icons-outlined text-primary-600 group-hover:scale-110 transition-transform">location_on</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600">Saved Addresses</p>
                        </div>
                        <span className="material-icons-outlined text-gray-300">chevron_right</span>
                    </div>
                    <div onClick={() => setActiveView('NOTIFICATIONS')} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors group">
                        <span className="material-icons-outlined text-primary-600 group-hover:scale-110 transition-transform">notifications</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600">Notification Settings</p>
                        </div>
                        <span className="material-icons-outlined text-gray-300">chevron_right</span>
                    </div>
                    <div onClick={() => setActiveView('HELP')} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors group">
                        <span className="material-icons-outlined text-primary-600 group-hover:scale-110 transition-transform">help_outline</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600">Help Center</p>
                        </div>
                        <span className="material-icons-outlined text-gray-300">chevron_right</span>
                    </div>
                </div>

                {/* Logout */}
                <div className="p-4 border-t border-gray-100 mt-2">
                    <button
                        onClick={() => {
                            logout();
                            onClose();
                            navigate('/');
                        }}
                        className="w-full py-2.5 text-sm font-bold text-red-600 border border-red-100 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-outlined text-lg">logout</span>
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black z-[100]"
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        ref={drawerRef}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'tween', duration: 0.3 }}
                        className="fixed top-0 right-0 h-full w-[400px] bg-white z-[101] shadow-2xl overflow-hidden flex flex-col"
                    >
                        {renderContent()}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProfileDrawer;
