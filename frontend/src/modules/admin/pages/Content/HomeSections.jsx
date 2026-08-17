import React, { useState, useEffect } from 'react';
import {
    MdEdit,
    MdSave,
    MdClose,
    MdAdd,
    MdDelete,
    MdSearch,
    MdVisibility,
    MdArrowBack,
    MdInventory
} from 'react-icons/md';
import { useContentStore } from '../../store/contentStore';
import useProductStore from '../../store/productStore';
import { matchesNormalizedSearch } from '../../utils/search';

const HomeSections = () => {
    const {
        homeSections,
        updateSectionTitle,
        updateHomeSection,
        createHomeSection,
        deleteHomeSection,
        addProductToSection,
        removeProductFromSection,
        fetchHomeSections
    } = useContentStore();
    const { products, fetchProducts } = useProductStore();

    useEffect(() => {
        fetchHomeSections();
        fetchProducts();
    }, [fetchHomeSections, fetchProducts]);

    // Navigation State
    const [selectedSectionId, setSelectedSectionId] = useState(null);

    // Creates/Edit State
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ title: '', id: '', subtitle: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [editingSectionId, setEditingSectionId] = useState(null);

    // UI State
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingSubtitle, setIsEditingSubtitle] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newSubtitle, setNewSubtitle] = useState('');
    const [showProductModal, setShowProductModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const activeSection = homeSections.find(s => s.id === selectedSectionId);

    const handleSubmit = async () => {
        if (!formData.title || !formData.id) return;
        const finalId = formData.id.toLowerCase().replace(/\s+/g, '_');
        const data = { ...formData, id: finalId };

        if (isEditing) {
            await updateHomeSection(editingSectionId, data);
        } else {
            await createHomeSection(data);
        }

        setShowForm(false);
        setFormData({ title: '', id: '', subtitle: '' });
        setIsEditing(false);
        setEditingSectionId(null);
    };

    const handleEditOpen = (section, e) => {
        e.stopPropagation();
        setFormData({ title: section.title, id: section.id, subtitle: section.subtitle || '' });
        setEditingSectionId(section.id);
        setIsEditing(true);
        setShowForm(true);
    };

    const handleDeleteSection = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this section?')) {
            await deleteHomeSection(id);
            if (selectedSectionId === id) setSelectedSectionId(null);
        }
    };

    const handleEditTitleOpen = () => {
        setNewTitle(activeSection.title);
        setIsEditingTitle(true);
    };

    const handleEditSubtitleOpen = () => {
        setNewSubtitle(activeSection.subtitle || '');
        setIsEditingSubtitle(true);
    };

    const handleSaveTitle = () => {
        updateHomeSection(activeSection.id, { title: newTitle });
        setIsEditingTitle(false);
    };

    const handleSaveSubtitle = () => {
        updateHomeSection(activeSection.id, { subtitle: newSubtitle });
        setIsEditingSubtitle(false);
    };

    const filteredProducts = products.filter(p =>
        matchesNormalizedSearch(p.name, searchTerm) ||
        matchesNormalizedSearch(p.category, searchTerm)
    );

    // --- Main List View (Highly Compact) ---
    if (!selectedSectionId) {
        return (
            <div className="space-y-4">
                {/* Create/Edit Modal */}
                {showForm && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}></div>
                        <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-in zoom-in duration-200">
                            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">
                                {isEditing ? 'Edit Section' : 'Create New Section'}
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Section ID (Unique)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. summer_sale"
                                        value={formData.id}
                                        onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm font-normal text-gray-800 outline-none focus:bg-white focus:ring-2 ring-primary-100 transition"
                                    />
                                    {isEditing && <p className="text-[9px] text-orange-500 font-bold mt-1 uppercase">Warning: Changing ID may break external links.</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Display Title</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Summer Sale 50% Off"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm font-normal text-gray-800 outline-none focus:bg-white focus:ring-2 ring-primary-100 transition"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Subtitle (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="Small description text"
                                        value={formData.subtitle}
                                        onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm font-normal text-gray-800 outline-none focus:bg-white focus:ring-2 ring-primary-100 transition"
                                    />
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <button onClick={handleSubmit} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-xs font-black uppercase hover:bg-primary-700 transition">
                                        {isEditing ? 'Update Section' : 'Create Section'}
                                    </button>
                                    <button onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 text-gray-500 rounded-lg text-xs font-black uppercase hover:bg-gray-200 transition">Cancel</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
                    <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">All Sections</h3>
                        {!showForm && (
                            <button onClick={() => { setIsEditing(false); setFormData({ title: '', id: '', subtitle: '' }); setShowForm(true); }} className="flex items-center gap-2 text-[10px] font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition">
                                <MdAdd size={14} /> NEW SECTION
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900 border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Section Heading</th>
                                    <th className="px-6 py-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-center">Items</th>
                                    <th className="px-6 py-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {homeSections.map((section) => (
                                    <tr key={section.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setSelectedSectionId(section.id)}>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800">{section.title}</span>
                                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">{section.id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-xs font-black text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                                                {section.products?.length || 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={(e) => handleEditOpen(section, e)}
                                                    className="p-1.5 text-primary-400 hover:bg-primary-50 rounded-lg transition"
                                                >
                                                    <MdEdit size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setSelectedSectionId(section.id); }}
                                                    className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] font-black hover:bg-black transition shadow-sm"
                                                >
                                                    MANAGE
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteSection(section.id, e)}
                                                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
                                                >
                                                    <MdDelete size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {homeSections.length === 0 && (
                                    <tr><td colSpan="3" className="px-6 py-12 text-center text-xs text-gray-400 font-bold italic">No sections found. Create one above!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // --- Detail View (Compact Management) ---
    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedSectionId(null)} className="p-2 text-gray-400 hover:text-gray-900 transition"><MdArrowBack size={20} /></button>
                    {isEditingTitle ? (
                        <div className="flex items-center gap-2">
                            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="text-sm font-bold text-gray-900 border-b border-primary-500 outline-none w-48 bg-transparent" autoFocus />
                            <button onClick={handleSaveTitle} className="text-primary-600"><MdSave size={18} /></button>
                            <button onClick={() => setIsEditingTitle(false)} className="text-gray-400"><MdClose size={18} /></button>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 group">
                                <h2 className="text-sm font-black text-gray-900 uppercase tracking-tight">{activeSection.title}</h2>
                                <button onClick={handleEditTitleOpen} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-primary-600 transition"><MdEdit size={14} /></button>
                            </div>
                            {isEditingSubtitle ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input type="text" value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} className="text-[10px] font-bold text-gray-400 border-b border-primary-300 outline-none w-64 bg-transparent" autoFocus placeholder="Enter subtitle..." />
                                    <button onClick={handleSaveSubtitle} className="text-primary-400"><MdSave size={14} /></button>
                                    <button onClick={() => setIsEditingSubtitle(false)} className="text-gray-300"><MdClose size={14} /></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group mt-0.5">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                        {activeSection.subtitle || 'No subtitle set'}
                                    </p>
                                    <button onClick={handleEditSubtitleOpen} className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-primary-400 transition"><MdEdit size={12} /></button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setShowProductModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl text-[10px] font-black hover:bg-primary-700 transition"
                >
                    <MdAdd size={16} /> ADD PRODUCTS
                </button>
            </div>

            {/* Product List (Mini Cards) */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                {activeSection.products?.length === 0 ? (
                    <div className="py-12 text-center text-xs text-gray-400 font-bold italic">No products in this section yet.</div>
                ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {activeSection.products.map((p) => (
                            <div key={p.id} className="group relative bg-gray-50 border border-gray-100 rounded-xl p-1.5 hover:border-primary-200 transition">
                                <div className="aspect-square rounded-lg overflow-hidden bg-white mb-1.5">
                                    <img src={p.image} className="w-full h-full object-cover" />
                                </div>
                                <h4 className="text-[9px] font-bold text-gray-700 truncate px-0.5">{p.name}</h4>
                                <button onClick={() => removeProductFromSection(activeSection.id, p._id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white text-red-500 rounded-lg shadow-sm border border-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                    <MdDelete size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Compact Product Picker Modal */}
            {showProductModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowProductModal(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-4 border-b border-gray-50 flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">Select Products</h3>
                            <button onClick={() => setShowProductModal(false)}><MdClose size={20} className="text-gray-400" /></button>
                        </div>
                        <div className="p-4 bg-gray-50/50">
                            <div className="relative">
                                <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} type="text" placeholder="Search..." className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold outline-none focus:border-primary-400" />
                            </div>
                        </div>
                        <div className="max-h-[350px] overflow-y-auto p-4 space-y-2 no-scrollbar">
                            {filteredProducts.map(p => {
                                const exists = activeSection.products?.some(ap => ap.id === p.id);
                                return (
                                    <button key={p.id} disabled={exists} onClick={() => { addProductToSection(activeSection.id, p); setShowProductModal(false); }} className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-all text-left ${exists ? 'opacity-40 bg-gray-50 border-transparent' : 'bg-white border-gray-100 hover:border-primary-100'}`}>
                                        <img src={p.image} className="w-10 h-10 rounded-lg object-cover" />
                                        <div className="flex-1 min-w-0"><p className="text-[10px] font-black text-gray-800 truncate">{p.name}</p><p className="text-[9px] text-gray-400 font-bold uppercase">₹{p.price}</p></div>
                                        {!exists && <MdAdd size={18} className="text-primary-500" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomeSections;
