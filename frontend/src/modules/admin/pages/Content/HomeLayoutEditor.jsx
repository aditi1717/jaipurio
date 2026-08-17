import React, { useEffect } from 'react';
import { useContentStore } from '../../store/contentStore';
import useBannerStore from '../../store/bannerStore';
import { 
    MdAdd, 
    MdDelete, 
    MdViewCarousel,
    MdViewAgenda, 
    MdDragIndicator 
} from 'react-icons/md';
import { Reorder } from 'framer-motion';

const HomeLayoutEditor = () => {
    const { 
        homeSections, 
        fetchHomeSections, 
        homeLayout, 
        fetchHomeLayout, 
        updateHomeLayout 
    } = useContentStore();
    
    const { banners, fetchBanners } = useBannerStore();

    console.log('HomeLayoutEditor State:', { bannersCount: banners.length, layoutCount: homeLayout.length });

    useEffect(() => {
        fetchHomeSections();
        fetchBanners();
        fetchHomeLayout();
    }, [fetchHomeSections, fetchBanners, fetchHomeLayout]);

    // Helpers to get details
    const getSectionDetails = (id) => homeSections.find(s => String(s.id) === String(id));
    const getBannerDetails = (id) => banners.find(b => String(b._id || b.id) === String(id));

    const handleAddToLayout = (type, id) => {
        const newItem = {
            type,
            referenceId: id,
            _id: `temp-${Date.now()}` // Temporary unique key for stable dragging before DB save
        };
        updateHomeLayout([...homeLayout, newItem]);
    };

    const handleRemoveFromLayout = (index) => {
        const newLayout = [...homeLayout];
        newLayout.splice(index, 1);
        updateHomeLayout(newLayout);
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
            {/* Left Col: Available Content */}
            <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Available Content</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Banners List */}
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                            <MdViewCarousel className="text-purple-500" /> Banners
                        </h4>
                        <div className="space-y-2">
                            {banners.map(banner => (
                                <div key={banner.id || banner._id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-white border border-transparent hover:border-purple-200 hover:shadow-sm rounded-xl group transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                                            <img 
                                                src={(banner.type === 'hero' ? (banner.content?.backgroundImageUrl || banner.content?.imageUrl) : banner.slides?.[0]?.imageUrl) || ''} 
                                                className="w-full h-full object-cover" 
                                                onError={(e) => console.error('Layout List Thumb Error:', banner.type, banner._id, e.target.src)}
                                            />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-700 truncate">{banner.type === 'hero' ? banner.content?.title : 'Slideshow'}</p>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{banner.section}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleAddToLayout('banner', banner._id || banner.id)}
                                        className="p-1.5 bg-white text-purple-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MdAdd size={16} />
                                    </button>
                                </div>
                            ))}
                            {banners.length === 0 && <div className="text-xs text-gray-400 italic px-2">No banners available.</div>}
                        </div>
                    </div>

                    {/* Sections List */}
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                            <MdViewAgenda className="text-primary-500" /> Sections
                        </h4>
                        <div className="space-y-2">
                            {homeSections.map(section => (
                                <div key={section.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-white border border-transparent hover:border-primary-200 hover:shadow-sm rounded-xl group transition-all">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 text-primary-400 font-bold text-[10px]">
                                            {section.products?.length || 0}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-700 truncate">{section.title}</p>
                                            <p className="text-[9px] text-gray-400 font-bold uppercase">{section.id}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleAddToLayout('section', section.id)}
                                        className="p-1.5 bg-white text-primary-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <MdAdd size={16} />
                                    </button>
                                </div>
                            ))}
                             {homeSections.length === 0 && <div className="text-xs text-gray-400 italic px-2">No sections available.</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Col: Homepage Stream */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Homepage Layout Stream</h3>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-1 rounded-lg">{homeLayout.length} Items</span>
                </div>
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    {homeLayout.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50 space-y-4 py-20">
                            <MdDragIndicator size={48} />
                            <p className="font-bold text-sm">Your homepage stream is empty</p>
                            <p className="text-xs text-center max-w-xs">Add banners and sections from the left panel to build your homepage.</p>
                        </div>
                    ) : (
                        <Reorder.Group 
                            axis="y" 
                            values={homeLayout} 
                            onReorder={updateHomeLayout}
                            className="space-y-3"
                        >
                            {homeLayout.map((item, index) => {
                                const details = item.type === 'banner' ? getBannerDetails(item.referenceId) : getSectionDetails(item.referenceId);
                                if (!details) return null;

                                return (
                                    <Reorder.Item 
                                        key={item._id} 
                                        value={item}
                                        className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary-200 transition-colors bg-white relative group"
                                    >
                                        <div className="flex flex-col items-center gap-1 text-gray-500 group-hover:text-primary-600 transition-colors bg-gray-100 p-1 rounded-lg">
                                            <MdDragIndicator size={24} />
                                            <span className="text-[9px] font-black">{index + 1}</span>
                                        </div>

                                        {/* Preview Card */}
                                        <div className="flex-1 flex items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <div className="w-12 h-12 rounded-lg bg-white overflow-hidden shrink-0 border border-gray-100 relative">
                                                {item.type === 'banner' ? (
                                                    <img 
                                                        src={(details.type === 'hero' ? (details.content?.backgroundImageUrl || details.content?.imageUrl) : details.slides?.[0]?.imageUrl) || ''} 
                                                        className="w-full h-full object-cover" 
                                                        onError={(e) => console.error('Layout Stream Thumb Error:', details.type, details._id, e.target.src)}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-primary-500 bg-primary-50 font-black text-xs">
                                                        {details.products?.length}
                                                    </div>
                                                )}
                                                <div className={`absolute bottom-0 left-0 right-0 h-1 ${item.type === 'banner' ? 'bg-purple-500' : 'bg-primary-500'}`} />
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${item.type === 'banner' ? 'bg-purple-100 text-purple-700' : 'bg-primary-100 text-primary-700'}`}>
                                                        {item.type}
                                                    </span>
                                                    {item.type === 'banner' && <span className="text-[8px] font-bold text-gray-400 uppercase">{details.section}</span>}
                                                </div>
                                                <h4 className="text-sm font-bold text-gray-800 truncate">
                                                    {item.type === 'banner' ? (details.type === 'hero' ? details.content?.title : 'Slideshow Banner') : details.title}
                                                </h4>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent drag when clicking delete
                                                handleRemoveFromLayout(index);
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                        >
                                            <MdDelete size={20} />
                                        </button>
                                    </Reorder.Item>
                                );
                            })}
                        </Reorder.Group>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomeLayoutEditor;
