import React, { useState, useEffect } from 'react';
import HomeSections from './HomeSections';
import HomeBanners from './HomeBanners';
import HomeLayoutEditor from './HomeLayoutEditor';
import { MdViewAgenda, MdViewCarousel, MdLayers } from 'react-icons/md';
import { useLocation } from 'react-router-dom';

const HomeContentManager = () => {
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(location.pathname.includes('banners') ? 'banners' : 'layout');

    useEffect(() => {
        if (location.pathname.includes('banners')) setActiveTab('banners');
        else if (location.pathname.includes('sections')) setActiveTab('sections');
        else setActiveTab('layout');
    }, [location]);

    return (
        <div className="space-y-4 max-w-7xl mx-auto">
            {/* Header & Mini Tab Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm mb-2">
                <div>
                    <h1 className="text-base font-black text-gray-900 flex items-center gap-2 uppercase tracking-tight">
                        {activeTab === 'layout' && <MdLayers size={20} className="text-orange-500" />}
                        {activeTab === 'sections' && <MdViewAgenda size={20} className="text-primary-500" />}
                        {activeTab === 'banners' && <MdViewCarousel size={20} className="text-purple-500" />}
                        Homepage Content
                    </h1>
                </div>

                <div className="flex bg-gray-100/50 p-1 rounded-xl border border-gray-100">
                    <button
                        onClick={() => setActiveTab('layout')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeTab === 'layout' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        LAYOUT
                    </button>
                    <button
                        onClick={() => setActiveTab('sections')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeTab === 'sections' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        SECTIONS
                    </button>
                    <button
                        onClick={() => setActiveTab('banners')}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeTab === 'banners' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        BANNERS
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'layout' && <HomeLayoutEditor />}
                {activeTab === 'sections' && <HomeSections />}
                {activeTab === 'banners' && <HomeBanners />}
            </div>
        </div>
    );
};

export default HomeContentManager;
