import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../../services/api';
import { useAuthStore } from '../store/authStore';
import { MdStore, MdEmail, MdPhone, MdLocationOn, MdDescription, MdBusiness, MdAssignment, MdKeyboardArrowDown } from 'react-icons/md';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const BUSINESS_TYPES = ['Individual', 'Partnership', 'Private Limited', 'Public Limited', 'Other'];

const BecomeSeller = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuthStore();

    const [formData, setFormData] = useState({
        storeName: '',
        businessEmail: '',
        phoneNumber: '',
        businessAddress: '',
        taxId: '',
        businessType: 'Individual',
        description: ''
    });

    const [status, setStatus] = useState(null); // 'Pending', 'Approved', 'Rejected'
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const fieldClass = "w-full px-4 py-2.5 rounded-lg bg-white border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all font-medium outline-none text-gray-900 placeholder:text-gray-400 caret-primary-600";

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login?redirect=/become-seller');
            return;
        }

        const fetchMyRequest = async () => {
            try {
                const { data } = await API.get('/seller-requests/my-request');
                if (data) {
                    setStatus(data.status);
                    setFormData(data);
                }
            } catch (err) {
                console.error('Error fetching seller request:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMyRequest();
    }, [isAuthenticated, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        let nextValue = value;

        if (name === 'businessEmail') {
            nextValue = value.trim().toLowerCase();
        }

        if (name === 'phoneNumber') {
            nextValue = value.replace(/\D/g, '').slice(0, 10);
        }

        if (name === 'taxId') {
            nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
        }

        setFormData({ ...formData, [name]: nextValue });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const trimmedEmail = formData.businessEmail.trim().toLowerCase();
        const normalizedPhone = formData.phoneNumber.replace(/\D/g, '');
        const normalizedTaxId = formData.taxId.trim().toUpperCase();

        if (!EMAIL_REGEX.test(trimmedEmail)) {
            setError('Please enter a valid business email address.');
            return;
        }

        if (!PHONE_REGEX.test(normalizedPhone)) {
            setError('Please enter a valid 10-digit Indian mobile number.');
            return;
        }

        if (!GSTIN_REGEX.test(normalizedTaxId)) {
            setError('Please enter a valid 15-character GSTIN / Tax ID.');
            return;
        }

        setSubmitting(true);

        try {
            await API.post('/seller-requests', {
                ...formData,
                businessEmail: trimmedEmail,
                phoneNumber: normalizedPhone,
                taxId: normalizedTaxId
            });
            setSuccess(true);
            setStatus('Pending');
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (status === 'Pending' || success) {
        return (
            <div className="min-h-screen px-4 pt-6 md:pt-10 pb-8 bg-white flex items-start justify-center">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-primary-50">
                    <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MdAssignment className="text-4xl text-primary-600" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Application Received!</h2>
                    <p className="text-gray-600 mb-8 font-medium">
                        Your request to become a seller is currently under review by our admin team. We will notify you via email once approved.
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'Approved') {
        return (
            <div className="min-h-screen px-4 pt-6 md:pt-10 pb-8 bg-white flex items-start justify-center">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-green-50">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <MdStore className="text-4xl text-green-600" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Congratulations!</h2>
                    <p className="text-gray-600 mb-8 font-medium">
                        Your seller account has been approved. You can now start listing your products and growing your business with us.
                    </p>
                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200"
                    >
                        Go to Seller Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-0 pb-6 px-3 md:px-4 bg-white">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                    {/* Header */}
                    <div className="bg-primary-600 p-4 md:p-5 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <MdStore size={88} />
                        </div>
                        <h1 className="text-xl md:text-2xl font-black mb-1">Become a Seller</h1>
                        <p className="text-primary-100 text-sm font-medium opacity-90">Fill in the details below to start your selling journey on Jaipurio.</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-4 md:p-5 space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 animate-pulse">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Store Name */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                    <MdStore className="text-primary-600" /> Store Name
                                </label>
                                <input
                                    required
                                    type="text"
                                    name="storeName"
                                    value={formData.storeName}
                                    onChange={handleChange}
                                    placeholder="e.g. My Awesome Shop"
                                    className={fieldClass}
                                />
                            </div>

                            {/* Business Email */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                    <MdEmail className="text-primary-600" /> Business Email
                                </label>
                                <input
                                    required
                                    type="email"
                                    name="businessEmail"
                                    value={formData.businessEmail}
                                    onChange={handleChange}
                                    placeholder="e.g. contact@myshop.com"
                                    className={fieldClass}
                                    inputMode="email"
                                    autoComplete="email"
                                />
                            </div>

                            {/* Phone Number */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                    <MdPhone className="text-primary-600" /> Phone Number
                                </label>
                                <input
                                    required
                                    type="tel"
                                    name="phoneNumber"
                                    value={formData.phoneNumber}
                                    onChange={handleChange}
                                    placeholder="e.g. 9876543210"
                                    className={fieldClass}
                                    inputMode="numeric"
                                    autoComplete="tel"
                                    maxLength="10"
                                />
                            </div>

                            {/* Tax ID */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                    <MdAssignment className="text-primary-600" /> GSTIN / Tax ID
                                </label>
                                <input
                                    required
                                    type="text"
                                    name="taxId"
                                    value={formData.taxId}
                                    onChange={handleChange}
                                    placeholder="e.g. 22AAAAA0000A1Z5"
                                    className={fieldClass}
                                    autoCapitalize="characters"
                                    maxLength="15"
                                />
                            </div>
                        </div>

                        {/* Business Type */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                <MdBusiness className="text-primary-600" /> Business Type
                            </label>
                            <div className="relative">
                                <select
                                    name="businessType"
                                    value={formData.businessType}
                                    onChange={handleChange}
                                    className={`${fieldClass} appearance-none cursor-pointer pr-12`}
                                >
                                    {BUSINESS_TYPES.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                                <MdKeyboardArrowDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-500" />
                            </div>
                        </div>

                        {/* Business Address */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                <MdLocationOn className="text-primary-600" /> Business Address
                            </label>
                            <textarea
                                required
                                name="businessAddress"
                                value={formData.businessAddress}
                                onChange={handleChange}
                                placeholder="Complete business address..."
                                rows="2"
                                className={`${fieldClass} resize-none`}
                            ></textarea>
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                <MdDescription className="text-primary-600" /> Business Description
                            </label>
                            <textarea
                                required
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Tell us about the products you plan to sell..."
                                rows="3"
                                className={`${fieldClass} resize-none`}
                            ></textarea>
                        </div>

                        <button
                            disabled={submitting}
                            type="submit"
                            className="w-full bg-primary-600 text-white font-black py-3 rounded-xl hover:bg-primary-700 transition-all shadow-md shadow-primary-100 flex items-center justify-center gap-2 group disabled:opacity-70"
                        >
                            {submitting ? (
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Submit Application
                                    <MdStore className="text-xl group-hover:scale-110 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BecomeSeller;
