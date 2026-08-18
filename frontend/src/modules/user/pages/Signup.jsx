import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
const logo = '/logo.png';

import toast from 'react-hot-toast';

const Signup = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { sendOtp, loading, error } = useAuthStore();
    const [mobile, setMobile] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const from = location.state?.from?.pathname || '/';

    const handleSignup = async () => {
        if (!name.trim()) return toast.error('Please enter your name');
        if (!email.trim() || !email.includes('@')) return toast.error('Please enter a valid email');
        const mobileRegex = /^[6-9]\d{9}$/;
        if (mobileRegex.test(mobile)) {
            try {
                await sendOtp(mobile);
                toast.success(`OTP sent to ${mobile}`);
                // Navigate to login to verify OTP, passing mobile, name, and email
                navigate('/login', { state: { mobile, name, email } }); 
            } catch (err) {
                 // Error handled by store/hook, but we can also show it
                 toast.error(error || 'Failed to send OTP');
            }
        } else {
            toast.error('Please enter a valid 10-digit Indian mobile number (starting with 6-9)');
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header */}
            <div className="bg-primary-600 p-4 flex items-center">
                <button onClick={() => navigate('/login')} className="material-icons text-white mr-4">arrow_back</button>
                <span className="text-white font-bold text-lg">Create Account</span>
            </div>

            <div className="p-8 flex-1 flex flex-col">
                <div className="mb-8 mt-4">
                    <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mb-6 overflow-hidden border border-gray-100 p-1">
                        <img src={logo} alt="logo" className="w-full h-full object-contain" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Looks like you're new here!</h2>
                    <p className="text-sm text-gray-500">Sign up with your mobile number to get started</p>
                </div>

                <div className="space-y-6">
                    <div className="relative">
                        <label className="text-[10px] uppercase text-primary-600 font-bold absolute -top-1.5 left-3 bg-white px-1">Full Name</label>
                        <div className="flex items-center border border-primary-600 rounded-lg overflow-hidden h-12">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1 h-full px-4 outline-none text-gray-900 font-medium"
                                placeholder="Enter your full name"
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="text-[10px] uppercase text-primary-600 font-bold absolute -top-1.5 left-3 bg-white px-1">Email Address</label>
                        <div className="flex items-center border border-primary-600 rounded-lg overflow-hidden h-12">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-1 h-full px-4 outline-none text-gray-900 font-medium"
                                placeholder="Enter your email"
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <label className="text-[10px] uppercase text-primary-600 font-bold absolute -top-1.5 left-3 bg-white px-1">Mobile Number</label>
                        <div className="flex items-center border border-primary-600 rounded-lg overflow-hidden h-12">
                            <span className="pl-4 text-gray-500 text-sm font-medium">+91</span>
                            <input
                                type="tel"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                className="flex-1 h-full px-4 outline-none text-gray-900 font-medium"
                                placeholder="Enter mobile number"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSignup}
                        className="w-full bg-primary-600 text-white py-3.5 rounded-sm font-bold text-sm shadow-lg shadow-primary-600/20 active:scale-[0.98] transition-all"
                    >
                        Continue
                    </button>

                    <button
                        onClick={() => navigate('/login')}
                        className="w-full bg-white text-primary-600 border border-gray-200 py-3.5 rounded-sm font-bold text-sm active:scale-[0.98] transition-all"
                    >
                        ExistingUser? Log in
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Signup;
