import React, { useEffect, useState } from 'react';
import { MdArrowBack, MdEmail, MdPerson, MdPhone } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const ProfileSettings = () => {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const updateProfile = useAuthStore((state) => state.updateProfile);
    const currentUser = user;
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const normalizeGender = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return '';
        if (normalized === 'male') return 'Male';
        if (normalized === 'female') return 'Female';
        if (normalized === 'other') return 'Other';
        return '';
    };

    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        email: '',
        gender: ''
    });

    useEffect(() => {
        if (!currentUser) return;
        const rawPhone = currentUser?.phone || currentUser?.mobile || '';
        const rawEmail = currentUser?.email || '';
        const normalizedPhone = String(rawPhone).trim();
        const normalizedEmail = String(rawEmail).trim();
        const digitsFromEmail = normalizedEmail.replace(/\D/g, '');
        const looksLikePhoneInEmail = normalizedEmail && !normalizedEmail.includes('@') && digitsFromEmail.length >= 10;

        setFormData({
            name: currentUser?.name || '',
            mobile: normalizedPhone || (looksLikePhoneInEmail ? digitsFromEmail : ''),
            email: looksLikePhoneInEmail ? '' : normalizedEmail,
            gender: normalizeGender(currentUser?.gender)
        });
    }, [currentUser]);

    const handleSave = async () => {
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

        try {
            const promise = updateProfile({ ...formData, name: trimmedName, email: trimmedEmail });
            await toast.promise(promise, {
                loading: 'Updating profile...',
                success: 'Profile updated successfully!',
                error: (err) => `Update failed: ${err.message}`
            });
            navigate('/account', { replace: true });
        } catch (error) {
            console.error('Error saving profile:', error);
        }
    };

    return (
        <div className="min-h-screen bg-[#f6f8fb] text-gray-900">
            <div className="w-full px-4 sm:px-5 md:px-7 py-4 md:py-6">
                <div className="max-w-4xl mx-auto space-y-4">
                    <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
                        <button
                            onClick={() => navigate('/account')}
                            className="w-10 h-10 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center shadow-sm"
                            aria-label="Go back"
                        >
                            <MdArrowBack size={20} />
                        </button>
                        <div className="text-center">
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 text-center break-words">
                                Profile Settings
                            </h1>
                        </div>
                        <div />
                    </div>

                    <div className="bg-white border border-gray-100 rounded-[28px] shadow-[0_12px_40px_rgba(15,23,42,0.06)] overflow-hidden">
                        <div className="p-5 md:p-8 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                    <div className="relative">
                                        <MdPerson className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                if (/\d/.test(value)) return;
                                                setFormData({ ...formData, name: value });
                                            }}
                                            className="w-full border border-gray-300 rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500 bg-white"
                                            placeholder="Enter your full name"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                                    <select
                                        value={formData.gender}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500 bg-white"
                                    >
                                        <option value="">Select gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                <div className="relative">
                                    <MdEmail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                                        className="w-full border border-gray-300 rounded-xl pl-11 pr-4 py-3 text-sm text-gray-900 outline-none focus:border-primary-500 bg-white"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
                                <div className="relative">
                                    <MdPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        value={formData.mobile}
                                        disabled
                                        className="w-full border border-gray-200 bg-gray-50 rounded-xl pl-11 pr-4 py-3 text-sm text-gray-500 cursor-not-allowed outline-none"
                                        placeholder="Mobile number"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-3">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-primary-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors shadow-sm"
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={() => navigate('/account')}
                                    className="flex-1 border border-gray-300 bg-white text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileSettings;
