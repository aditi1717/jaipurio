import React, { useState, useEffect, useMemo } from 'react';
import { MdAdd, MdEdit, MdDelete, MdExpandMore, MdChevronRight } from 'react-icons/md';
import useSubCategoryStore from '../../store/subCategoryStore';
import SubCategoryForm from './SubCategoryForm';
import { confirmToast } from '../../../../utils/toastUtils.jsx';
import { matchesNormalizedSearch } from '../../utils/search';

const getCategoryId = (sub) => String(sub?.category?._id || sub?.category || 'uncategorized');
const getCategoryName = (sub) => sub?.category?.name || 'Unassigned';

const SubCategoryList = () => {
    const subCategories = useSubCategoryStore((state) => state.subCategories);
    const deleteSubCategory = useSubCategoryStore((state) => state.deleteSubCategory);
    const fetchSubCategories = useSubCategoryStore((state) => state.fetchSubCategories);
    const isLoading = useSubCategoryStore((state) => state.isLoading);

    const [showForm, setShowForm] = useState(false);
    const [editingSubCategory, setEditingSubCategory] = useState(null);
    const [expandedCategoryId, setExpandedCategoryId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSubCategories();
    }, [fetchSubCategories]);

    const handleEdit = (subCategory) => {
        setEditingSubCategory(subCategory);
        setShowForm(true);
    };

    const handleDelete = (id, name) => {
        confirmToast({
            message: `Are you sure you want to delete subcategory "${name}"?`,
            type: 'danger',
            icon: 'delete_sweep',
            confirmText: 'Delete SubCategory',
            onConfirm: () => deleteSubCategory(id)
        });
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingSubCategory(null);
    };

    const toggleCategory = (categoryId) => {
        setExpandedCategoryId((prev) => (prev === categoryId ? null : categoryId));
    };

    const categoryGroups = useMemo(() => {
        const filtered = (subCategories || []).filter(sub => (
            matchesNormalizedSearch(sub.name, searchTerm) ||
            matchesNormalizedSearch(getCategoryName(sub), searchTerm)
        ));

        const byCategory = new Map();

        for (const sub of filtered) {
            const categoryId = getCategoryId(sub);
            const categoryName = getCategoryName(sub);
            if (!byCategory.has(categoryId)) {
                byCategory.set(categoryId, { categoryId, name: categoryName, items: [] });
            }
            byCategory.get(categoryId).items.push(sub);
        }

        return [...byCategory.values()]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((group) => ({
                ...group,
                items: [...group.items].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
            }));
    }, [subCategories, searchTerm]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">SubCategories</h1>
                    <p className="text-gray-500 mt-1">Each subcategory belongs directly to one category (no nested hierarchy).</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search subcategories..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-64 rounded-lg border border-gray-200 bg-white pl-4 pr-10 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                    >
                        <MdAdd size={20} />
                        Add SubCategory
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading subcategories...</div>
                ) : categoryGroups.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No subcategories found.</div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {categoryGroups.map((group) => {
                            const isExpanded = expandedCategoryId === group.categoryId;

                            return (
                                <div key={group.categoryId} className="bg-white">
                                    <button
                                        type="button"
                                        onClick={() => toggleCategory(group.categoryId)}
                                        className={`w-full flex items-center justify-between px-5 py-4 text-left transition ${isExpanded ? 'bg-primary-50/70 border-b border-primary-100' : 'hover:bg-gray-50'}`}
                                    >
                                        <span className="flex items-center gap-2 font-bold text-primary-900 text-lg">
                                            {isExpanded ? <MdExpandMore /> : <MdChevronRight />}
                                            {group.name}
                                        </span>
                                        <span className="text-xs font-semibold text-primary-700 bg-primary-100 px-3 py-1 rounded-full">
                                            {group.items.length} items
                                        </span>
                                    </button>

                                    {isExpanded ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-900 border-b border-slate-800">
                                                        <th className="p-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Name</th>
                                                        <th className="p-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Category</th>
                                                        <th className="p-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Status</th>
                                                        <th className="p-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {group.items.map((sub) => (
                                                        <tr key={sub._id || sub.id} className="hover:bg-gray-50 transition">
                                                            <td className="p-4 font-semibold text-gray-800">{sub.name}</td>
                                                            <td className="p-4 text-gray-700 text-sm">{group.name}</td>
                                                            <td className="p-4">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${sub.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {sub.isActive ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleEdit(sub)}
                                                                        className="p-2 hover:bg-primary-50 rounded-lg text-primary-600 transition"
                                                                    >
                                                                        <MdEdit size={18} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(sub._id || sub.id, sub.name)}
                                                                        className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition"
                                                                    >
                                                                        <MdDelete size={18} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showForm && (
                <SubCategoryForm
                    subCategory={editingSubCategory}
                    onClose={handleCloseForm}
                />
            )}
        </div>
    );
};

export default SubCategoryList;
