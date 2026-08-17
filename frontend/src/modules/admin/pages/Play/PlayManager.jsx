import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete, MdPlayArrow, MdRemoveRedEye, MdFavorite, MdShoppingBag } from 'react-icons/md';
import usePlayStore from '../../store/playStore';
import PlayForm from './PlayForm';

const PlayManager = () => {
    const { reels, deleteReel, toggleReelStatus, fetchReels } = usePlayStore();
    const [showForm, setShowForm] = useState(false);
    const [editingReel, setEditingReel] = useState(null);

    useEffect(() => {
        fetchReels();
    }, [fetchReels]);

    const handleEdit = (reel) => {
        setEditingReel(reel);
        setShowForm(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this reel?')) {
            deleteReel(id);
        }
    };

    const handleClose = () => {
        setShowForm(false);
        setEditingReel(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Play (Reels) Management</h1>
                    <p className="text-gray-500 text-sm">Manage video content and shoppable reels</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg transition font-medium"
                >
                    <MdAdd size={22} /> Upload Reel
                </button>
            </div>

            {/* Reels Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {reels.length === 0 ? (
                    <div className="col-span-full py-20 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                        <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MdPlayArrow size={32} className="text-pink-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">No Reels Yet</h3>
                        <p className="text-gray-500 text-sm mt-1">Upload your first video to get started</p>
                    </div>
                ) : (
                    reels.map(reel => (
                        <div key={reel._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl transition-all duration-300">
                            {/* Video Preview */}
                            <div className="h-48 bg-black relative">
                                <video
                                    src={reel.videoUrl}
                                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
                                />

                                {/* Overlay Controls */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleEdit(reel)}
                                            className="p-1.5 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/40 transition"
                                            title="Edit"
                                        >
                                            <MdEdit size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(reel._id)}
                                            className="p-1.5 bg-white/20 backdrop-blur-sm rounded-full text-red-500 hover:bg-white/40 transition"
                                            title="Delete"
                                        >
                                            <MdDelete size={16} />
                                        </button>
                                    </div>

                                    <div className="flex justify-center">
                                        <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center">
                                            <MdPlayArrow size={24} className="text-white ml-1" />
                                        </div>
                                    </div>

                                    <div></div> {/* Spacer */}
                                </div>

                                {/* Status Badge */}
                                <div className={`absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${reel.active ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
                                    }`}>
                                    {reel.active ? 'Live' : 'Hidden'}
                                </div>
                            </div>

                            {/* Details */}
                            <div className="p-3">
                                {/* Product Link URL */}
                                <div className="flex items-center gap-2 text-xs text-primary-600 bg-primary-50 px-2 py-1.5 rounded-lg mb-2 w-full">
                                    <MdShoppingBag size={14} className="shrink-0" />
                                    <span className="font-medium truncate">{reel.productLink || 'No Link Added'}</span>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center justify-between text-gray-500 text-xs pt-2 border-t border-gray-100">
                                    <div className="flex items-center gap-1">
                                        <MdRemoveRedEye size={14} /> {reel.views || 0}
                                    </div>
                                    <div className="flex items-center gap-1 text-pink-500">
                                        <MdFavorite size={14} /> {reel.likes || 0}
                                    </div>
                                    <button
                                        onClick={() => toggleReelStatus(reel._id)}
                                        className="text-gray-400 hover:text-primary-600 font-medium transition"
                                    >
                                        {reel.active ? 'Hide' : 'Publish'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showForm && (
                <PlayForm
                    reel={editingReel}
                    onClose={handleClose}
                />
            )}
        </div>
    );
};

export default PlayManager;
