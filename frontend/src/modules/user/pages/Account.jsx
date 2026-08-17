import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MdPerson, MdInventory2, MdLocationOn,
    MdFavoriteBorder,
    MdDescription, MdSupportAgent,
    MdPowerSettingsNew, MdChevronRight, MdArrowBack, MdDeleteForever
} from 'react-icons/md';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useContentStore } from '../../admin/store/contentStore';
import toast from 'react-hot-toast';

const Account = () => {
    const navigate = useNavigate();
    const { user, updateProfile, logout, deleteAccount } = useAuthStore();
    const { pages, fetchPages } = useContentStore();
    const [isEditing, setIsEditing] = useState(false);

    const currentUser = user;

    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        email: '',
        gender: ''
    });
    const [passwordData, setPasswordData] = useState({
        newPassword: '',
        confirmPassword: ''
    });

    const mapProfileToFormData = (profile) => {
        const rawPhone = profile?.phone || profile?.mobile || '';
        const rawEmail = profile?.email || '';
        const normalizedPhone = String(rawPhone).trim();
        const normalizedEmail = String(rawEmail).trim();
        const digitsFromEmail = normalizedEmail.replace(/\D/g, '');
        const looksLikePhoneInEmail = normalizedEmail && !normalizedEmail.includes('@') && digitsFromEmail.length >= 10;

        return {
            name: profile?.name || '',
            mobile: normalizedPhone || (looksLikePhoneInEmail ? digitsFromEmail : ''),
            email: looksLikePhoneInEmail ? '' : normalizedEmail,
            gender: profile?.gender || ''
        };
    };

    useEffect(() => {
        if (currentUser) {
            setFormData(mapProfileToFormData(currentUser));
        }
    }, [currentUser]);

    useEffect(() => {
        fetchPages();
    }, [fetchPages]);

    const handleSave = async () => {
        if (passwordData.newPassword || passwordData.confirmPassword) {
            if (passwordData.newPassword.length < 6) {
                toast.error('New password must be at least 6 characters');
                return;
            }
            if (passwordData.newPassword !== passwordData.confirmPassword) {
                toast.error('Passwords do not match');
                return;
            }
        }

        try {
            const payload = {
                ...formData,
                ...(passwordData.newPassword ? { password: passwordData.newPassword } : {})
            };
            const promise = updateProfile(payload);
            await toast.promise(promise, {
                loading: 'Updating profile...',
                success: 'Profile updated successfully!',
                error: (err) => `Update failed: ${err.message}`
            });
            setIsEditing(false);
            setPasswordData({ newPassword: '', confirmPassword: '' });
        } catch (error) {
            console.error('Error saving profile:', error);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setPasswordData({ newPassword: '', confirmPassword: '' });
        if (currentUser) {
            setFormData(mapProfileToFormData(currentUser));
        }
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm('Are you sure you want to delete your account? This action cannot be undone.');

        if (!confirmed) {
            return;
        }

        try {
            await toast.promise(deleteAccount(), {
                loading: 'Deleting account...',
                success: 'Account deleted successfully',
                error: (error) => error?.response?.data?.message || error?.message || 'Failed to delete account'
            });

            navigate('/', { replace: true });
        } catch (error) {
            console.error('Error deleting account:', error);
        }
    };

    const menuItems = [
        { icon: <MdInventory2 size={24} />, label: 'Orders', sublabel: 'Check your orders status and history here', path: '/my-orders', color: '#2874f0' },
        { icon: <MdInventory2 size={24} />, label: 'Returns', sublabel: 'Manage refunds and exchanges requests', path: '/my-orders?tab=returns', color: '#2874f0' },
        { icon: <MdPerson size={24} />, label: 'Profile Settings', sublabel: 'Update your password, profile details and more', path: '/settings', color: '#2874f0' },
        { icon: <MdLocationOn size={24} />, label: 'Addresses', sublabel: 'Add, edit, or manage your address easily', path: '/addresses', color: '#2874f0' },
        { icon: <MdFavoriteBorder size={24} />, label: 'Wishlist', sublabel: 'Shop your specially saved items from here', path: '/wishlist', color: '#2874f0' },
        { icon: <MdSupportAgent size={24} />, label: 'Help Center', sublabel: 'Get help for orders, payments and more', path: '/info?type=dynamic&key=help-center', color: '#2874f0' },
    ];

    const mobileProfilePages = (pages || [])
        .filter((page) => page?.showInMobileProfile && page?.pageKey)
        .map((page) => ({
            icon: <MdDescription size={24} />,
            label: page.title || String(page.pageKey).replace(/-/g, ' ').replace(/(?:^|\s)\S/g, (char) => char.toUpperCase()),
            sublabel: '',
            path: `/info?type=dynamic&key=${page.pageKey}`,
            color: '#2874f0'
        }));

    const mobileMenuItems = [...menuItems, ...mobileProfilePages];

    // Filter menu items based on actual routes we have or keep existing functionality. 
    // The user asked to keep "our data".
    // Existing items were: Orders, Wishlist, Addresses, Coupons, Help Center, Privacy Policy.
    // The screenshot has: Orders, Returns, Coupons, Profile Settings, Addresses, Wishlist.
    // I will use the screenshot's layout preferences but ensure the links work.

    // Mapping existing functional links to the new desire card layout:
    const dashboardCards = [
        {
            icon: <MdInventory2 className="text-[#2874f0]" size={32} />,
            label: 'Orders',
            sublabel: 'Check your orders status and history here',
            path: '/my-orders'
        },
        {
            icon: <MdInventory2 className="text-[#2874f0]" size={32} />, // Using same icon as orders for returns if specific one not avail
            label: 'Returns',
            sublabel: 'Manage refunds and exchanges requests',
            path: '/my-orders' // Redirecting to orders as we don't have specific returns page yet
        },
        {
            icon: <MdPerson className="text-[#2874f0]" size={32} />,
            label: 'Profile Settings',
            sublabel: 'Update your password, profile details and more',
            path: '/settings'
        },
        {
            icon: <MdLocationOn className="text-[#2874f0]" size={32} />,
            label: 'Addresses',
            sublabel: 'Add, edit, or manage your address easily',
            path: '/addresses'
        },
        {
            icon: <MdFavoriteBorder className="text-[#2874f0]" size={32} />,
            label: 'Wishlist',
            sublabel: 'Shop your specially saved items from here',
            path: '/wishlist'
        },
        {
            icon: <MdSupportAgent className="text-[#2874f0]" size={32} />,
            label: 'Help Center',
            sublabel: 'Get help for orders, payments and more',
            path: '/info?type=dynamic&key=help-center'
        }
    ];

    return (
        <div className="bg-[#f1f3f6] min-h-screen">
            {/* Mobile View (Restored Original Layout) */}
            <div className="md:hidden max-w-3xl mx-auto pb-20">
                {/* Profile Card */}
                <div className="bg-white rounded-lg shadow-sm -mt-4 mb-4">
                    {/* Profile Header */}
                    <div className="p-4 border-b border-gray-100">
                        <button onClick={() => navigate('/')} className="mb-4 text-gray-600 hover:text-[#2874f0] block">
                            <MdArrowBack size={24} />
                        </button>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-[#2874f0] flex items-center justify-center text-white text-xl font-bold">
                                {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-semibold text-gray-900 truncate">
                                    {currentUser?.name || 'User'}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {currentUser?.phone ? `+91 ${currentUser.phone}` : currentUser?.email || ''}
                                </p>
                            </div>
                            {!isEditing && (
                                <button
                                    onClick={() => navigate('/settings')}
                                    className="text-[#2874f0] text-sm font-medium hover:underline"
                                >
                                    Edit
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Edit Form (Mobile) */}
                    {isEditing && (
                        <div className="p-4 border-b border-gray-100 bg-gray-50">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Full Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:border-[#2874f0] focus:ring-1 focus:ring-[#2874f0] outline-none"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:border-[#2874f0] focus:ring-1 focus:ring-[#2874f0] outline-none"
                                        placeholder="Enter your email"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Mobile Number</label>
                                    <input
                                        type="tel"
                                        value={formData.mobile}
                                        disabled
                                        className="w-full border border-gray-200 rounded-md px-3 py-2.5 text-sm bg-gray-100 text-gray-400 cursor-not-allowed"
                                        placeholder="Mobile number"
                                    />
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={handleSave}
                                        className="flex-1 bg-[#2874f0] text-white py-2.5 rounded-md text-sm font-medium hover:bg-[#1a5dc8] transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="px-6 py-2.5 text-gray-600 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">New Password</label>
                                    <input
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:border-[#2874f0] focus:ring-1 focus:ring-[#2874f0] outline-none"
                                        placeholder="Enter new password"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:border-[#2874f0] focus:ring-1 focus:ring-[#2874f0] outline-none"
                                        placeholder="Confirm new password"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Menu Items (Mobile) */}
                    <div className="divide-y divide-gray-100">
                        {mobileMenuItems.map((item, index) => (
                            <div
                                key={index}
                                onClick={() => {
                                    if (item.action) item.action();
                                    else if (item.path) navigate(item.path);
                                }}
                                className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                                    {item.sublabel ? (
                                        <p className="text-xs text-gray-500">{item.sublabel}</p>
                                    ) : null}
                                </div>
                                <MdChevronRight size={22} className="text-gray-400" />
                            </div>
                        ))}
                    </div>

                    {/* Logout (Mobile) - Red Background as requested */}
                    <div className="p-4 border-t border-gray-100">
                        <button
                            onClick={handleDeleteAccount}
                            className="mb-3 w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white font-medium text-sm hover:bg-red-700 rounded-md transition-colors"
                        >
                            <MdDeleteForever size={20} />
                            <span>Delete Account</span>
                        </button>
                        <button
                            onClick={() => {
                                logout();
                                navigate('/');
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 rounded-md transition-colors"
                        >
                            <MdPowerSettingsNew size={20} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
                {/* Account Info Footer */}
                <div className="text-center py-6 px-4">
                    <p className="text-xs text-gray-400">
                        Account created {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : ''}
                    </p>
                </div>
            </div>

            {/* Desktop View (New Sidebar Layout) */}
            <div className="hidden md:flex flex-row min-h-screen bg-gray-50">
                {/* Left Sidebar - Light Blue Theme */}
                <div className="w-[350px] bg-primary-50 text-slate-900 p-6 min-h-screen flex flex-col gap-6 shrink-0">
                    <button onClick={() => navigate('/')} className="self-start mb-2 text-slate-500 hover:text-[#2874f0] transition-colors p-1 -ml-1">
                        <MdArrowBack size={24} />
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-sm mb-1">Hey</p>
                            <h1 className="text-3xl font-bold">{currentUser?.name?.split(' ')[0] || 'User'}</h1>
                        </div>
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-xl font-bold text-[#2874f0] border-2 border-primary-200">
                                {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                            <button
                                onClick={() => navigate('/settings')}
                                className="absolute -bottom-1 -right-1 bg-white text-black p-1 rounded-full shadow-md hover:bg-gray-200 transition"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-5 mt-4">
                        {/* Full Name */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Full Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                disabled={!isEditing}
                                className={`w-full bg-white border ${isEditing ? 'border-[#2874f0]' : 'border-gray-300'} rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-[#2874f0] transition-colors shadow-sm`}
                                placeholder="Full Name"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Email Address</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                disabled={!isEditing}
                                className={`w-full bg-white border ${isEditing ? 'border-[#2874f0]' : 'border-gray-300'} rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-[#2874f0] transition-colors shadow-sm`}
                                placeholder="Email Address"
                            />
                        </div>

                        {/* Mobile Number */}
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Mobile Number</label>
                            <input
                                type="text"
                                value={formData.mobile}
                                // Mobile usually not editable directly or requires OTP, keeping consistent with old logic
                                disabled={true}
                                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-500 cursor-not-allowed focus:outline-none shadow-sm"
                                placeholder="Phone Number"
                            />
                        </div>

                        {isEditing && (
                            <div className="space-y-3 pt-2">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">New Password</label>
                                    <input
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        className="w-full bg-white border border-[#2874f0] rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-[#2874f0] transition-colors shadow-sm"
                                        placeholder="Enter new password"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500 font-medium uppercase tracking-wider">Confirm Password</label>
                                    <input
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        className="w-full bg-white border border-[#2874f0] rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-[#2874f0] transition-colors shadow-sm"
                                        placeholder="Confirm new password"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleSave}
                                        className="flex-1 bg-[#2874f0] text-white py-2.5 rounded-lg text-sm font-bold hover:bg-primary-600 transition-colors shadow-md"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="flex-1 bg-transparent border border-slate-300 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleDeleteAccount}
                            className="mt-2 w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white font-medium text-sm hover:bg-red-700 rounded-lg transition-colors"
                        >
                            <MdDeleteForever size={20} />
                            <span>Delete Account</span>
                        </button>

                        <button
                            onClick={() => {
                                logout();
                                navigate('/');
                            }}
                            className="mt-4 w-full flex items-center justify-center gap-2 py-3 text-red-500 font-medium text-sm hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                        >
                            <MdPowerSettingsNew size={20} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>

                {/* Main Content - Dashboard Grid */}
                <div className="flex-1 p-6 md:p-10">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                        <p className="text-gray-500 mt-1">Manage your account and view orders</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {dashboardCards.map((card, index) => (
                            <div
                                key={index}
                                onClick={() => {
                                    if (card.action) card.action();
                                    else navigate(card.path);
                                }}
                                className="bg-white p-6 rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_16px_rgb(0,0,0,0.08)] transition-all cursor-pointer group flex flex-col justify-between h-[180px]"
                            >
                                <div className="mb-4">
                                    <div className="p-0 transition-transform group-hover:scale-110 origin-left duration-300 inline-block">
                                        {card.icon}
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-2">{card.label}</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">
                                        {card.sublabel}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;
