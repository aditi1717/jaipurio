import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdVisibility, MdVisibilityOff } from 'react-icons/md';
import useAdminAuthStore from '../store/adminAuthStore';
const logo = '/logo.png';

import toast from 'react-hot-toast';

const AdminLogin = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { login, loading } = useAdminAuthStore();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const success = await login(username, password);
        if (success) {
            toast.success('Welcome back, Admin!');
            navigate('/admin/dashboard');
        } else {
            toast.error('Invalid credentials. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <img
                        src={logo}
                        alt="Jaipurio"
                        className="h-12 w-auto mx-auto mb-4 scale-[2] origin-center"
                    />
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">Admin Panel</h1>
                    <p className="text-gray-500">Sign in to manage your store</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            name="admin-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                            autoComplete="off"
                            className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-gray-900 ${loading ? 'bg-gray-50 cursor-not-allowed opacity-75' : 'bg-white'}`}
                            placeholder="Enter your username"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="admin-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                autoComplete="new-password"
                                className={`w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-gray-900 ${loading ? 'bg-gray-50 cursor-not-allowed opacity-75' : 'bg-white'}`}
                                placeholder="Enter your password"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                disabled={loading}
                                className={`absolute inset-y-0 right-0 px-3 flex items-center ${loading ? 'cursor-not-allowed text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                title={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-3 rounded-lg font-semibold transition-all shadow-lg flex items-center justify-center gap-2 ${loading ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Signing In...</span>
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
