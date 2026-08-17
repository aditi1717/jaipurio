import React, { useEffect, useState } from 'react';
import { MdClose } from 'react-icons/md';
import toast from 'react-hot-toast';
import useCategoryStore from '../../store/categoryStore';

const initialFormState = {
    name: '',
    image: '',
    active: true,
    file: null
};

const CategoryForm = ({ category, onClose }) => {
    const { addCategory, updateCategory, isLoading, fetchCategoryById } = useCategoryStore();
    const isEditMode = Boolean(category?.id);
    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        const loadCategory = async () => {
            if (!category?.id) {
                setFormData(initialFormState);
                return;
            }

            try {
                const fullCategory = await fetchCategoryById(category.id);
                setFormData({
                    name: fullCategory.name || '',
                    image: fullCategory.icon || fullCategory.image || '',
                    active: fullCategory.active ?? true,
                    file: null
                });
            } catch (err) {
                console.error('Failed to fetch full category:', err);
                toast.error('Failed to load full category details');
            }
        };

        loadCategory();
    }, [category, fetchCategoryById]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const imageUrl = URL.createObjectURL(file);
        setFormData((prev) => ({ ...prev, image: imageUrl, file }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const data = new FormData();
        data.append('name', formData.name.trim());
        data.append('active', String(formData.active));

        if (formData.file) {
            data.append('icon', formData.file);
        } else if (formData.image) {
            data.append('icon', formData.image);
        }

        try {
            if (isEditMode) {
                await updateCategory(category.id, data);
                toast.success('Category updated successfully', { duration: 1200 });
            } else {
                await addCategory(data);
                toast.success('Category created successfully', { duration: 1200 });
            }
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save category');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-3 backdrop-blur-[1px] md:p-6">
            <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 p-3 md:p-4">
                    <h2 className="text-lg font-bold text-gray-800 md:text-xl">
                        {isEditMode ? 'Edit Category' : 'Add New Category'}
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="rounded-lg p-2 transition hover:bg-gray-100"
                    >
                        <MdClose size={20} className="text-gray-600 md:h-6 md:w-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-3 md:p-4">
                    <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-700 md:text-sm">
                            Category Name *
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            autoComplete="off"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-primary-500 md:px-4 md:py-3 md:text-base"
                            placeholder="Enter category name"
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold text-gray-700 md:text-sm">
                            Category Image
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-primary-500 md:px-4 md:py-3 md:text-base"
                        />
                        {formData.image && (
                            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                                <p className="mb-2 text-xs text-gray-600">Image Preview:</p>
                                <img
                                    src={formData.image}
                                    alt="Category preview"
                                    className="h-24 w-24 rounded-lg object-cover"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="active"
                            name="active"
                            checked={formData.active}
                            onChange={handleChange}
                            className="h-4 w-4 rounded text-primary-600 focus:ring-2 focus:ring-primary-500 md:h-5 md:w-5"
                        />
                        <label htmlFor="active" className="text-xs font-medium text-gray-700 md:text-sm">
                            Active (Category will be visible to users)
                        </label>
                    </div>

                    <div className="sticky bottom-0 flex gap-3 bg-white pb-1 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className={`flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition md:px-6 md:py-3 md:text-base ${isLoading ? 'cursor-not-allowed bg-gray-100 opacity-70' : 'hover:bg-gray-50'}`}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition md:px-6 md:py-3 md:text-base ${isLoading ? 'cursor-not-allowed bg-primary-400' : 'bg-primary-600 hover:bg-primary-700'}`}
                        >
                            {isLoading ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    <span>{isEditMode ? 'Updating...' : 'Creating...'}</span>
                                </>
                            ) : (
                                `${isEditMode ? 'Update' : 'Create'} Category`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CategoryForm;
