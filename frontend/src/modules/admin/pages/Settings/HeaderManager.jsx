import React, { useEffect, useState, useMemo } from 'react';
import useCategoryStore from '../../store/categoryStore';
import { useHeaderStore } from '../../store/headerStore';
import { 
    MdSave, 
    MdDragIndicator, 
    MdCheckBox, 
    MdInfo, 
    MdAdd,
    MdFolder,
    MdList
} from 'react-icons/md';
import toast from 'react-hot-toast';

// DnD Kit imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * SortableItem Component
 * Represents a category in the reorderable preview list
 */
const SortableItem = ({ id, category, onRemove }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: String(id) });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`mb-2 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3 ${
                isDragging ? 'ring-2 ring-primary-100 opacity-50 z-50' : 'hover:bg-gray-50 transition-colors'
            }`}
        >
            <div className="flex items-center gap-3">
                <div 
                    {...attributes} 
                    {...listeners} 
                    className="p-1.5 rounded-lg text-gray-300 hover:bg-gray-100 hover:text-primary-500 cursor-grab active:cursor-grabbing transition-colors"
                >
                    <MdDragIndicator size={22} />
                </div>
                
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600">
                    <MdList size={20} />
                </div>
                
                <div>
                    <h4 className="font-bold text-gray-800 text-sm">{category?.name || 'Unnamed Category'}</h4>
                    <p className="text-[10px] uppercase font-bold text-gray-400">
                        {category?.children?.length || category?.subCategories?.length || 0} Subcategories
                    </p>
                </div>
            </div>

            <button
                type="button"
                onClick={() => onRemove(id)}
                className="p-2 text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                title="Remove from header"
            >
                <MdCheckBox size={24} />
            </button>
        </div>
    );
};

const HeaderManager = () => {
    const { categories = [], fetchCategories } = useCategoryStore();
    const { headerCategories = [], fetchHeaderConfig, updateHeaderConfig, isLoading } = useHeaderStore();
    
    const [selectedIds, setSelectedIds] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);

    // Initial Data Fetch
    useEffect(() => {
        fetchCategories();
        fetchHeaderConfig();
    }, [fetchCategories, fetchHeaderConfig]);

    // Sync local state when config is fetched
    useEffect(() => {
        if (headerCategories && Array.isArray(headerCategories)) {
            setSelectedIds(headerCategories.map(c => String(c?._id || c?.id)));
        }
    }, [headerCategories]);

    // Helper to find category object by ID
    const findCategory = (id) => {
        if (!categories || !Array.isArray(categories)) return null;
        return categories.find(c => String(c?._id || c?.id) === String(id));
    };

    // Derived: Selected categories in their current order
    const selectedList = useMemo(() => {
        if (!selectedIds) return [];
        return selectedIds
            .map(id => findCategory(id))
            .filter(Boolean);
    }, [selectedIds, categories]);

    // Derived: Valid string IDs for DnD context
    const validRenderIds = useMemo(() => {
        return selectedList.map(c => String(c?._id || c?.id));
    }, [selectedList]);

    // Derived: Categories NOT in the header
    const availableList = useMemo(() => {
        if (!categories) return [];
        const selectedIdSet = new Set(selectedIds);
        return categories.filter(c => !selectedIdSet.has(String(c?._id || c?.id)));
    }, [categories, selectedIds]);

    // Sensor Configuration
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // DnD Event Handler
    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setSelectedIds((items) => {
                const oldIndex = items.indexOf(String(active.id));
                const newIndex = items.indexOf(String(over.id));
                
                if (oldIndex !== -1 && newIndex !== -1) {
                    setHasChanges(true);
                    return arrayMove(items, oldIndex, newIndex);
                }
                return items;
            });
        }
    };

    // Add to selected list
    const addToHeader = (id) => {
        const idStr = String(id);
        if (!selectedIds.includes(idStr)) {
            setSelectedIds(prev => [...prev, idStr]);
            setHasChanges(true);
        }
    };

    // Remove from selected list
    const removeFromHeader = (id) => {
        const idStr = String(id);
        setSelectedIds(prev => prev.filter(pid => String(pid) !== idStr));
        setHasChanges(true);
    };

    // Save to Backend
    const handleSave = async () => {
        try {
            await updateHeaderConfig(selectedIds);
            toast.success('Header menu saved successfully!');
            setHasChanges(false);
        } catch (error) {
            toast.error('Failed to update header configuration');
        }
    };

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Header Settings</h1>
                    <p className="text-sm text-gray-500">Choose which categories appear in the top user strip and reorder them.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleSave}
                        disabled={isLoading || !hasChanges}
                        className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                            hasChanges 
                                ? 'bg-primary-600 text-white hover:bg-primary-700' 
                                : 'border border-gray-200 bg-white text-gray-300 cursor-not-allowed'
                        }`}
                    >
                        <MdSave size={20} />
                        {isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left Column: Preview & Reorder */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2">
                            Selected Categories ({selectedList.length})
                        </span>
                        {hasChanges && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                Unsaved Changes
                            </span>
                        )}
                    </div>

                    <div className="min-h-[560px] rounded-2xl border border-gray-200 bg-white p-5">
                        {selectedList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-12 py-24">
                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
                                    <MdInfo size={32} className="text-gray-200" />
                                </div>
                                <h3 className="mb-1 font-semibold text-gray-800">No categories added yet</h3>
                                <p className="text-gray-400 text-sm max-w-[200px]">Add categories from the list on the right to start building your menu.</p>
                            </div>
                        ) : (
                            <DndContext 
                                sensors={sensors} 
                                collisionDetection={closestCenter} 
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext 
                                    items={validRenderIds} 
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-1">
                                        {selectedList.map((category) => (
                                            <SortableItem 
                                                key={String(category?._id || category?.id)} 
                                                id={String(category?._id || category?.id)}
                                                category={category} 
                                                onRemove={removeFromHeader}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        )}
                        <p className="mt-6 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-gray-300">
                            <MdInfo size={14} /> Only active categories will show on front-end
                        </p>
                    </div>
                </div>

                {/* Right Column: Available Categories */}
                <div className="space-y-4">
                    <span className="block px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Available Categories ({availableList.length})
                    </span>

                    <div className="max-h-[700px] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 custom-scrollbar">
                        <div className="grid grid-cols-1 gap-2">
                            {availableList.map(category => (
                                <div 
                                    key={String(category?._id || category?.id)}
                                    onClick={() => addToHeader(category?._id || category?.id)}
                                    className="group flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition-colors group-hover:text-primary-500">
                                            <MdFolder size={20} />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="leading-none font-semibold text-gray-700 group-hover:text-primary-700">{category?.name || 'Unnamed'}</span>
                                            <span className="mt-1 text-[10px] font-semibold text-gray-400">{category?.active ? 'Active' : 'Disabled'}</span>
                                        </div>
                                    </div>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-300 transition group-hover:bg-primary-600 group-hover:text-white">
                                        <MdAdd size={20} />
                                    </div>
                                </div>
                            ))}
                            {availableList.length === 0 && (
                                <div className="text-center py-20">
                                    <p className="text-gray-400 text-sm font-medium italic">All categories are already in your menu.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeaderManager;
