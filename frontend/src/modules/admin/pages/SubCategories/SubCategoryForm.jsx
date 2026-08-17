import React, { useState, useEffect, useMemo } from 'react';
import { MdClose } from 'react-icons/md';
import toast from 'react-hot-toast';
import useSubCategoryStore from '../../store/subCategoryStore';
import useCategoryStore from '../../store/categoryStore';

const getId = (item) => String(item?._id || item?.id || '');
const getCategoryId = (sub) => String(sub?.category?._id || sub?.category || '');

const SubCategoryForm = ({ subCategory, onClose }) => {
    const { addSubCategory, updateSubCategory, isLoading } = useSubCategoryStore();
    const { categories, fetchCategories, isLoading: isCategoriesLoading } = useCategoryStore();

    const [formData, setFormData] = useState({
        name: '',
        image: '',
        category: '',
        isActive: true,
        file: null
    });

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const categoryOptions = useMemo(() => {
        const seen = new Set();
        const deduped = [];

        for (const cat of categories || []) {
            const key = getId(cat);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            deduped.push(cat);
        }

        return deduped;
    }, [categories]);

    useEffect(() => {
        if (subCategory) {
            setFormData({
                name: subCategory.name,
                image: subCategory.image || '',
                category: getCategoryId(subCategory),
                isActive: subCategory.isActive ?? true,
                file: null
            });
        } else {
            setFormData({
                name: '',
                image: '',
                category: '',
                isActive: true,
                file: null
            });
        }
    }, [subCategory]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFormData((prev) => ({
            ...prev,
            file,
            image: URL.createObjectURL(file)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.category) {
            toast.error('Please select a category.');
            return;
        }

        const data = new FormData();
        data.append('name', formData.name);
        data.append('category', formData.category);
        data.append('isActive', formData.isActive);

        if (formData.file) {
            data.append('image', formData.file);
        } else if (formData.image && !formData.image.startsWith('blob:')) {
            data.append('image', formData.image);
        }

        try {
            const ok = subCategory?._id || subCategory?.id
                ? await updateSubCategory(subCategory._id || subCategory.id, data)
                : await addSubCategory(data);

            if (ok) {
                onClose();
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save subcategory');
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-3 md:p-6 bg-black/10 backdrop-blur-[1px]">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-100">
                    <h2 className="text-lg md:text-xl font-bold text-gray-800">
                        {subCategory ? 'Edit SubCategory' : 'Add New SubCategory'}
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <MdClose size={20} className="md:w-6 md:h-6 text-gray-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-3 md:p-4 space-y-3 md:space-y-4">
                    <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Name *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 placeholder:text-gray-500"
                            placeholder="e.g. Mobile Accessories"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Category *</label>
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900"
                            required
                        >
                            <option value="">
                                {isCategoriesLoading ? 'Loading categories...' : '-- Select Category --'}
                            </option>
                            {categoryOptions.map((cat) => (
                                <option key={getId(cat)} value={getId(cat)}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        {!isCategoriesLoading && categoryOptions.length === 0 && (
                            <p className="text-xs text-red-500 mt-1">No categories found. Create a category first.</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">SubCategory Image</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 text-sm md:text-base"
                        />
                        {formData.image && (
                            <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                                <p className="text-xs text-gray-600 mb-2">Image Preview:</p>
                                <img
                                    src={formData.image}
                                    alt="SubCategory preview"
                                    className="w-24 h-24 object-cover rounded-lg"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        <input
                            type="checkbox"
                            id="isActive"
                            name="isActive"
                            checked={formData.isActive}
                            onChange={handleChange}
                            className="w-4 h-4 md:w-5 md:h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                        />
                        <label htmlFor="isActive" className="text-xs md:text-sm font-medium text-gray-700">Active</label>
                    </div>

                    <div className="flex gap-2 md:gap-3 pt-1 md:pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className={`flex-1 px-4 py-2.5 md:px-6 md:py-3 border border-gray-300 text-gray-700 rounded-lg transition font-semibold text-sm md:text-base ${isLoading ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'hover:bg-gray-50'}`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex-1 px-4 py-2.5 md:px-6 md:py-3 text-white rounded-lg transition font-semibold text-sm md:text-base flex items-center justify-center gap-2 ${isLoading ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'}`}
                        >
                            {isLoading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{subCategory ? 'Updating...' : 'Creating...'}</span>
                                </>
                            ) : (
                                `${subCategory ? 'Update' : 'Create'} SubCategory`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SubCategoryForm;
