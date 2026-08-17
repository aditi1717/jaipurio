import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NotificationSettings = () => {
    const navigate = useNavigate();
    const [settings, setSettings] = useState({
        promotional: true,
        orderUpdates: true,
        stockAlerts: false,
        newsletters: true,
        whatsapp: true,
        sms: false
    });

    const toggleSetting = (key) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const sections = [
        {
            title: 'Order Tracking',
            items: [
                { id: 'orderUpdates', label: 'Order Updates', desc: 'Get notified about your order status, delivery, and returns.', icon: 'local_shipping' }
            ]
        },
        {
            title: 'Offers & Promotions',
            items: [
                { id: 'promotional', label: 'Sale & Offers', desc: 'Personalized offers, coupons, and sale alerts.', icon: 'sell' },
                { id: 'stockAlerts', label: 'Stock Alerts', desc: 'Notify when items in your wishlist are back in stock.', icon: 'inventory' }
            ]
        },
        {
            title: 'Channels',
            items: [
                { id: 'whatsapp', label: 'WhatsApp Notifications', desc: 'Fastest way to get order updates and offers.', icon: 'message' },
                { id: 'sms', label: 'SMS Notifications', desc: 'Get important updates via text message.', icon: 'sms' },
                { id: 'newsletters', label: 'Email Newsletters', desc: 'Weekly digest of top deals and new launches.', icon: 'mail' }
            ]
        }
    ];

    return (
        <div className="bg-[#f1f3f6] min-h-screen md:py-6">

            {/* Mobile Header - Hidden on Desktop */}
            <div className="bg-white px-4 py-4 flex items-center gap-4 border-b sticky top-0 z-10 md:hidden">
                <button onClick={() => navigate(-1)} className="material-icons text-gray-700">arrow_back</button>
                <h1 className="text-lg font-bold text-gray-800">Notification Settings</h1>
            </div>

            {/* Desktop Container */}
            <div className="md:max-w-[800px] md:mx-auto md:flex md:gap-6 md:items-start">

                {/* Desktop Sidebar (Optional, usually just breadcrumbs/nav here) */}
                <div className="hidden md:block w-[280px] shrink-0 space-y-4">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span onClick={() => navigate('/')} className="cursor-pointer hover:text-primary-600">Home</span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span onClick={() => navigate('/account')} className="cursor-pointer hover:text-primary-600">My Account</span>
                        <span className="material-icons text-[10px]">chevron_right</span>
                        <span className="text-gray-800 font-bold">Notifications</span>
                    </div>

                    <div className="bg-white p-4 shadow-sm rounded-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center">
                                <span className="material-icons text-primary-600">notifications</span>
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">Notification Preferences</p>
                                <p className="text-[10px] text-gray-500">Manage how you receive updates</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="space-y-2 pb-10 md:flex-1 md:space-y-4 md:pb-0">

                    <h1 className="hidden md:block text-lg font-bold text-gray-800 mb-4">Notification Settings</h1>

                    {sections.map((section, idx) => (
                        <div key={idx} className="bg-white shadow-sm md:rounded-sm md:border md:border-gray-200">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 md:bg-white md:px-6 md:py-4">
                                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider md:text-xs">{section.title}</h3>
                            </div>
                            <div className="divide-y divide-gray-50 md:divide-gray-100">
                                {section.items.map((item) => (
                                    <div key={item.id} className="p-4 flex items-start justify-between gap-4 active:bg-gray-50 transition-colors md:px-6 md:py-5 md:hover:bg-gray-50/50">
                                        <div className="flex gap-4">
                                            <div className="mt-1">
                                                <span className="material-icons text-primary-600 opacity-80 md:text-2xl">{item.icon}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800 md:text-base">{item.label}</span>
                                                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed md:text-sm">{item.desc}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleSetting(item.id)}
                                            className={`w-12 h-6 rounded-full relative transition-all duration-300 flex-shrink-0 cursor-pointer ${settings[item.id] ? 'bg-primary-600' : 'bg-gray-200'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${settings[item.id] ? 'right-1' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    <div className="p-4 mt-4">
                        <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold">
                            Jaipurio Private Limited
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationSettings;
