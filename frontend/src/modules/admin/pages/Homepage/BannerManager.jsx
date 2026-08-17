import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdToggleOn, MdToggleOff } from 'react-icons/md';
import useBannerStore from '../../store/bannerStore';
import BannerForm from './BannerForm';
import { confirmToast } from '../../../../utils/toastUtils.jsx';

const BannerManager = () => {
    const { banners, deleteBanner, toggleBannerStatus, fetchBanners } = useBannerStore();
    const [filterSection, setFilterSection] = useState('All');
    const [showForm, setShowForm] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);

    useEffect(() => {
        fetchBanners();
    }, [fetchBanners]);

    const sections = ['All', 'For You', 'Electronics', 'Fashion', 'Mobiles', 'Home & Kitchen', 'Grocery'];

    const filteredBanners = filterSection === 'All'
        ? banners
        : banners.filter(b => b.section === filterSection);

    const handleEdit = (banner) => {
        setEditingBanner(banner);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        confirmToast({
            message: 'Are you sure you want to delete this banner collection?',
            type: 'danger',
            icon: 'delete_forever',
            confirmText: 'Delete Collection',
            onConfirm: () => deleteBanner(id)
        });
    };

    const handleClose = () => {
        setShowForm(false);
        setEditingBanner(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Banner Management</h1>
                    <p className="text-gray-500 text-sm">Manage homepage sliders</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                >
                    <MdAdd size={20} /> New Collection
                </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {sections.map(section => (
                    <button
                        key={section}
                        onClick={() => setFilterSection(section)}
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${filterSection === section
                            ? 'bg-gray-800 text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        {section}
                    </button>
                ))}
            </div>

            {/* Banners Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBanners.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                        No banner collections found for this section.
                    </div>
                ) : (
                    filteredBanners.map(banner => (
                        <div key={banner._id || banner.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition">
                            {/* Slide Preview Grid */}
                            <div className="h-48 w-full bg-gray-100 relative grid grid-cols-2 gap-0.5">
                                {banner.slides.slice(0, 4).map((slide, index) => (
                                    <div key={index} className="relative overflow-hidden">
                                        <img
                                            src={slide.imageUrl}
                                            alt="Slide"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ))}
                                {banner.slides.length > 4 && (
                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                                        +{banner.slides.length - 4} more
                                    </div>
                                )}

                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                        onClick={() => handleEdit(banner)}
                                        className="p-2 bg-white rounded-full text-primary-600 shadow-sm hover:scale-105"
                                    >
                                        <MdEdit size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(banner._id || banner.id)}
                                        className="p-2 bg-white rounded-full text-red-500 shadow-sm hover:scale-105"
                                    >
                                        <MdDelete size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="px-2 py-1 bg-gray-100 text-xs font-semibold text-gray-600 rounded">
                                            {banner.section}
                                        </span>
                                        <p className="text-gray-500 text-xs mt-1">
                                            {banner.slides.length} {banner.slides.length === 1 ? 'Slide' : 'Slides'}
                                        </p>
                                    </div>
                                    <button onClick={() => toggleBannerStatus(banner._id || banner.id)}>
                                        {banner.active ? (
                                            <MdToggleOn size={28} className="text-green-500" />
                                        ) : (
                                            <MdToggleOff size={28} className="text-gray-300" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showForm && (
                <BannerForm
                    banner={editingBanner}
                    onClose={handleClose}
                />
            )}
        </div>
    );
};

export default BannerManager;
