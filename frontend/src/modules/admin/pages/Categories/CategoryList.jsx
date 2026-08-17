import React, { useState, useEffect } from 'react';
import { MdAdd, MdEdit, MdDelete } from 'react-icons/md';
import useCategoryStore from '../../store/categoryStore';
import CategoryForm from './CategoryForm';
import Pagination from '../../components/common/Pagination';
import { confirmToast } from '../../../../utils/toastUtils.jsx';

const CategoryList = () => {
    const entityLabel = 'Category';
    
    const categories = useCategoryStore((state) => state.categories);
    const fetchCategories = useCategoryStore((state) => state.fetchCategories);
    const deleteCategory = useCategoryStore((state) => state.deleteCategory);
    const toggleCategoryStatus = useCategoryStore((state) => state.toggleCategoryStatus);
    const isLoading = useCategoryStore((state) => state.isLoading);
    const error = useCategoryStore((state) => state.error);

    const [showForm, setShowForm] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const totalPages = Math.ceil(categories.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedCategories = categories.slice(startIndex, startIndex + itemsPerPage);

    const handleEdit = (category) => {
        setEditingCategory(category);
        setShowForm(true);
    };

    const handleDelete = (id, name) => {
        confirmToast({
            message: `Are you sure you want to delete "${name}"?\nAll subcategories under it will also be deleted.`,
            type: 'danger',
            icon: 'delete_sweep',
            confirmText: `Delete ${entityLabel}`,
            onConfirm: () => deleteCategory(id)
        });
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingCategory(null);
    };

    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <h1 className="text-xl md:text-3xl font-bold text-gray-800">
                        Category Management
                    </h1>
                    <p className="text-xs md:text-base text-gray-500 mt-1">
                        Only root categories are shown here.
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-1 md:gap-2 bg-primary-600 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg hover:bg-primary-700 transition text-xs md:text-base font-bold"
                >
                    <MdAdd size={16} className="md:w-5 md:h-5" />
                    Add Category
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-3 md:p-4 border-b border-gray-100">
                    <h2 className="text-base md:text-lg font-bold text-gray-800">Categories</h2>
                    <p className="text-xs text-gray-500 mt-1">Newest categories appear at the top.</p>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center">
                        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-500 font-medium">Loading categories...</p>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center text-red-500">
                        <p className="font-bold">Error loading categories</p>
                        <p className="text-sm mt-1">{error}</p>
                        <button 
                            onClick={() => fetchCategories()}
                            className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm font-semibold"
                        >
                            Retry
                        </button>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <p>No categories found. Create your first category.</p>
                    </div>
                ) : (
                    <div>
                        {paginatedCategories.map((category) => {
                            const categoryId = category.id || category._id;

                            return (
                                <div key={categoryId} className="flex items-center justify-between p-2.5 md:p-3 hover:bg-gray-50 border-b border-gray-100 transition">
                                    <div className="flex items-center gap-2 md:gap-3 flex-1">
                                        {(category.icon || category.image) ? (
                                            <img
                                                src={category.icon || category.image}
                                                alt={category.name}
                                                className="w-8 h-8 md:w-10 md:h-10 rounded-lg object-cover bg-gray-100"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] md:text-xs">
                                                N/A
                                            </div>
                                        )}

                                        <h4 className="font-semibold text-sm md:text-base text-gray-800">{category.name}</h4>
                                    </div>

                                    <div className="flex items-center gap-1 md:gap-2">
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleCategoryStatus(categoryId);
                                            }}
                                            className={`w-8 h-5 md:w-11 md:h-6 flex items-center rounded-full p-0.5 md:p-1 cursor-pointer transition-colors duration-300 ${category.active ? 'bg-green-500' : 'bg-gray-300'}`}
                                        >
                                            <div
                                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${category.active ? 'translate-x-3 md:translate-x-5' : 'translate-x-0'}`}
                                            />
                                        </div>

                                        <button
                                            onClick={() => handleEdit(category)}
                                            className="p-1.5 md:p-2 hover:bg-primary-50 rounded-lg text-primary-600 transition"
                                            title="Edit"
                                        >
                                            <MdEdit size={16} className="md:w-[18px] md:h-[18px]" />
                                        </button>

                                        <button
                                            onClick={() => handleDelete(categoryId, category.name)}
                                            className="p-1.5 md:p-2 hover:bg-red-50 rounded-lg text-red-600 transition"
                                            title="Delete"
                                        >
                                            <MdDelete size={16} className="md:w-[18px] md:h-[18px]" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}

            {showForm && (
                <CategoryForm
                    category={editingCategory}
                    onClose={handleCloseForm}
                />
            )}
        </div>
    );
};

export default CategoryList;
