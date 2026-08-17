import React, { useEffect, useMemo, useState } from 'react';
import { MdAdd, MdChevronRight, MdDelete, MdEdit, MdExpandMore } from 'react-icons/md';
import useBrandStore from '../../store/brandStore';
import useSubCategoryStore from '../../store/subCategoryStore';
import { confirmToast } from '../../../../utils/toastUtils.jsx';
import { matchesNormalizedSearch } from '../../utils/search';
import BrandForm from './BrandForm';

const getId = (item) => String(item?._id || item?.id || '');
const getBrandSubcategoryId = (brand) => String(brand?.subcategory?._id || brand?.subcategory || '');

const BrandList = () => {
    const brands = useBrandStore((state) => state.brands);
    const fetchBrands = useBrandStore((state) => state.fetchBrands);
    const deleteBrand = useBrandStore((state) => state.deleteBrand);
    const isLoading = useBrandStore((state) => state.isLoading);

    const subCategories = useSubCategoryStore((state) => state.subCategories);
    const fetchSubCategories = useSubCategoryStore((state) => state.fetchSubCategories);

    const [showForm, setShowForm] = useState(false);
    const [editingBrand, setEditingBrand] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSubCategoryId, setExpandedSubCategoryId] = useState(null);

    useEffect(() => {
        fetchBrands();
        fetchSubCategories();
    }, [fetchBrands, fetchSubCategories]);

    const subCategoryMap = useMemo(() => {
        const map = new Map();
        for (const sub of subCategories || []) {
            map.set(getId(sub), sub);
        }
        return map;
    }, [subCategories]);

    const groups = useMemo(() => {
        const filtered = (brands || []).filter((brand) => {
            const sub = subCategoryMap.get(getBrandSubcategoryId(brand));
            return (
                matchesNormalizedSearch(brand?.name, searchTerm) ||
                matchesNormalizedSearch(sub?.name, searchTerm) ||
                matchesNormalizedSearch(sub?.category?.name, searchTerm)
            );
        });

        const bySub = new Map();

        for (const brand of filtered) {
            const resolvedSubId = getBrandSubcategoryId(brand);
            const subId = resolvedSubId || 'unassigned';
            const sub = subCategoryMap.get(subId);
            const subName = sub?.name || 'Unassigned Subcategory';
            const categoryName = sub?.category?.name || 'Unassigned Category';

            if (!bySub.has(subId)) {
                bySub.set(subId, { subId, subName, categoryName, items: [] });
            }

            bySub.get(subId).items.push(brand);
        }

        return [...bySub.values()]
            .sort((a, b) => a.subName.localeCompare(b.subName))
            .map((group) => ({
                ...group,
                items: [...group.items].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
            }));
    }, [brands, searchTerm, subCategoryMap]);

    const handleEdit = (brand) => {
        setEditingBrand(brand);
        setShowForm(true);
    };

    const handleDelete = (id, name) => {
        confirmToast({
            message: `Are you sure you want to delete brand "${name}"?`,
            type: 'danger',
            icon: 'delete_sweep',
            confirmText: 'Delete Brand',
            onConfirm: () => deleteBrand(id)
        });
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingBrand(null);
    };

    const toggleSubCategory = (subId) => {
        setExpandedSubCategoryId((prev) => (prev === subId ? null : subId));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Brands</h1>
                    <p className="text-gray-500 mt-1">Each brand belongs directly to one subcategory (no nested hierarchy).</p>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="text"
                        placeholder="Search brands..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-64 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
                    >
                        <MdAdd size={20} />
                        Add Brand
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-500">Loading brands...</div>
                ) : groups.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No brands found.</div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {groups.map((group) => {
                            const isExpanded = expandedSubCategoryId === group.subId;
                            return (
                                <div key={group.subId} className="bg-white">
                                    <button
                                        type="button"
                                        onClick={() => toggleSubCategory(group.subId)}
                                        className={`w-full flex items-center justify-between px-5 py-4 text-left transition ${isExpanded ? 'bg-primary-50/70 border-b border-primary-100' : 'hover:bg-gray-50'}`}
                                    >
                                        <span className="flex items-center gap-2 font-bold text-primary-900 text-lg">
                                            {isExpanded ? <MdExpandMore /> : <MdChevronRight />}
                                            {group.subName}
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
                                                        <th className="p-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Subcategory</th>
                                                        <th className="p-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest">Status</th>
                                                        <th className="p-4 text-[10px] md:text-xs font-black text-white uppercase tracking-widest text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {group.items.map((brand) => (
                                                        <tr key={getId(brand)} className="hover:bg-gray-50 transition">
                                                            <td className="p-4 font-semibold text-gray-800">{brand.name}</td>
                                                            <td className="p-4 text-gray-700 text-sm">{group.subName}</td>
                                                            <td className="p-4">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${brand.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {brand.isActive ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => handleEdit(brand)}
                                                                        className="p-2 hover:bg-primary-50 rounded-lg text-primary-600 transition"
                                                                    >
                                                                        <MdEdit size={18} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDelete(getId(brand), brand.name)}
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

            {showForm ? (
                <BrandForm
                    brand={editingBrand}
                    onClose={handleCloseForm}
                />
            ) : null}
        </div>
    );
};

export default BrandList;
