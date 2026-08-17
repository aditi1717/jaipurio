import React, { useEffect, useMemo, useState } from 'react';
import { MdClose } from 'react-icons/md';
import toast from 'react-hot-toast';
import useBrandStore from '../../store/brandStore';
import useSubCategoryStore from '../../store/subCategoryStore';
import { matchesNormalizedSearch } from '../../utils/search';

const getId = (item) => String(item?._id || item?.id || '');
const getSubCategoryId = (brand) => String(brand?.subcategory?._id || brand?.subcategory || '');

const BrandForm = ({ brand, onClose }) => {
    const addBrand = useBrandStore((state) => state.addBrand);
    const updateBrand = useBrandStore((state) => state.updateBrand);
    const isLoading = useBrandStore((state) => state.isLoading);
    const subCategories = useSubCategoryStore((state) => state.subCategories);
    const fetchSubCategories = useSubCategoryStore((state) => state.fetchSubCategories);
    const isSubCategoriesLoading = useSubCategoryStore((state) => state.isLoading);

    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        image: '',
        subcategory: '',
        isActive: true,
        file: null
    });

    useEffect(() => {
        fetchSubCategories();
    }, [fetchSubCategories]);

    useEffect(() => {
        if (brand) {
            setFormData({
                name: brand.name || '',
                image: brand.image || '',
                subcategory: getSubCategoryId(brand),
                isActive: brand.isActive ?? true,
                file: null
            });
        } else {
            setFormData({
                name: '',
                image: '',
                subcategory: '',
                isActive: true,
                file: null
            });
        }
    }, [brand]);

    const subCategoryOptions = useMemo(() => {
        return (subCategories || [])
            .filter((sub) => (
                matchesNormalizedSearch(sub?.name, searchTerm) ||
                matchesNormalizedSearch(sub?.category?.name, searchTerm)
            ))
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    }, [subCategories, searchTerm]);

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

        if (!formData.subcategory) {
            toast.error('Please select a subcategory.');
            return;
        }

        if (!formData.file && !formData.image) {
            toast.error('Please upload brand image.');
            return;
        }

        const payload = new FormData();
        payload.append('name', String(formData.name || '').trim());
        payload.append('subcategory', formData.subcategory);
        payload.append('isActive', formData.isActive);
        if (formData.file) {
            payload.append('image', formData.file);
        } else if (formData.image && !String(formData.image).startsWith('blob:')) {
            payload.append('image', formData.image);
        }

        const ok = brand?._id || brand?.id
            ? await updateBrand(brand._id || brand.id, payload)
            : await addBrand(payload);

        if (ok) onClose();
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-3 md:p-6 bg-black/10 backdrop-blur-[1px]">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-100">
                    <h2 className="text-lg md:text-xl font-bold text-gray-800">
                        {brand ? 'Edit Brand' : 'Add New Brand'}
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
                            placeholder="e.g. Nike"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs md:text-sm font-semibold text-gray-700">Subcategory *</label>
                        <input
                            type="text"
                            placeholder="Search subcategory..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 placeholder:text-gray-500 text-sm"
                        />
                        <select
                            name="subcategory"
                            value={formData.subcategory}
                            onChange={handleChange}
                            className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900"
                            required
                        >
                            <option value="">
                                {isSubCategoriesLoading ? 'Loading subcategories...' : '-- Select Subcategory --'}
                            </option>
                            {subCategoryOptions.map((sub) => {
                                const subId = getId(sub);
                                const catName = sub?.category?.name || 'Unassigned Category';
                                return (
                                    <option key={subId} value={subId}>
                                        {sub.name} ({catName})
                                    </option>
                                );
                            })}
                        </select>
                        {!isSubCategoriesLoading && subCategoryOptions.length === 0 ? (
                            <p className="text-xs text-red-500">No subcategories found. Create subcategory first.</p>
                        ) : null}
                    </div>

                    <div>
                        <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1 md:mb-2">Brand Image</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            required={!formData.image}
                            className="w-full px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 text-sm md:text-base"
                        />
                        {formData.image ? (
                            <div className="mt-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                                <p className="text-xs text-gray-600 mb-2">Image Preview:</p>
                                <img
                                    src={formData.image}
                                    alt="Brand preview"
                                    className="w-24 h-24 object-cover rounded-lg"
                                />
                            </div>
                        ) : null}
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
                                    <span>{brand ? 'Updating...' : 'Creating...'}</span>
                                </>
                            ) : (
                                `${brand ? 'Update' : 'Create'} Brand`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BrandForm;
