import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories, useSubCategoriesByCategory } from '../../../hooks/useData';
import { useHeaderStore } from '../../admin/store/headerStore';
import {
    MdGridView,
    MdCheckroom,
    MdSmartphone,
    MdFace,
    MdLaptop,
    MdHome,
    MdShoppingBasket,
    MdBolt
} from 'react-icons/md';
import API from '../../../services/api';

const toThumbnailSrc = (url = '', size = 120) => {
    const src = String(url || '').trim();
    if (!src) return '';

    // Cloudinary transformation for faster thumbnail delivery.
    if (src.includes('res.cloudinary.com') && src.includes('/upload/')) {
        return src.replace('/upload/', `/upload/f_auto,q_auto,w_${size},h_${size},c_fill/`);
    }

    return src;
};

const prefetchedThumbs = new Set();
const prefetchThumbnail = (url, size = 140) => {
    const thumb = toThumbnailSrc(url, size);
    if (!thumb || prefetchedThumbs.has(thumb)) return;
    prefetchedThumbs.add(thumb);
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = thumb;
};

const CircleImage = ({ src, alt, sizeClass = 'w-16 h-16', fallback = null, priority = false, thumbSize = 128 }) => {
    const [loaded, setLoaded] = useState(false);
    const [errored, setErrored] = useState(false);
    const imgRef = React.useRef(null);
    const optimizedSrc = useMemo(() => toThumbnailSrc(src, thumbSize), [src, thumbSize]);

    // Handle cached images that are already complete when they mount.
    useEffect(() => {
        if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
            setLoaded(true);
        }
    }, [optimizedSrc]);

    if (!optimizedSrc || errored) {
        return fallback;
    }

    return (
        <div className={`relative ${sizeClass} rounded-full overflow-hidden bg-gray-50`}>
            {!loaded && <div className="absolute inset-0 shimmer rounded-full" />}
            <img
                ref={imgRef}
                key={optimizedSrc}
                src={optimizedSrc}
                alt={alt}
                className={`w-full h-full object-cover rounded-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                loading={priority ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={priority ? 'high' : 'auto'}
                onLoad={() => setLoaded(true)}
                onError={() => setErrored(true)}
            />
        </div>
    );
};

const AllCategoriesSkeleton = () => (
    <div className="bg-white min-h-screen flex flex-col pb-24">
        <div className="bg-white sticky top-0 z-10 px-3 py-3 border-b border-gray-100">
            <div className="h-6 w-40 rounded shimmer" />
        </div>
        <div className="flex flex-1 min-h-0">
            <div className="w-1/4 max-w-[100px] bg-gray-50 border-r border-gray-200 px-2 py-3 space-y-3">
                {Array.from({ length: 7 }).map((_, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full shimmer" />
                        <div className="h-2.5 w-12 rounded shimmer" />
                    </div>
                ))}
            </div>
            <div className="flex-1 p-4">
                <div className="h-5 w-36 rounded shimmer mb-4" />
                <div className="grid grid-cols-3 gap-3">
                    {Array.from({ length: 9 }).map((_, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 rounded-full shimmer" />
                            <div className="h-2.5 w-14 rounded shimmer" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const AllCategories = () => {
    const navigate = useNavigate();
    const { categories, loading: categoriesLoading } = useCategories({ lite: true });
    const { headerCategories, fetchHeaderConfig, isLoading: headerLoading } = useHeaderStore();

    useEffect(() => {
        fetchHeaderConfig();
    }, []);
    
    const normalizedHeaderCategories = useMemo(() => {
        return (headerCategories || [])
            .filter((cat) => cat && cat.active !== false && cat.name !== 'For You')
            .map((cat) => ({
                ...cat,
                subCategories: Array.isArray(cat.subCategories) ? cat.subCategories : []
            }));
    }, [headerCategories]);

    const sourceCategories = useMemo(() => {
        const activeFromCategories = (categories || []).filter(
            (cat) => cat && cat.active !== false && cat.name !== 'For You'
        );
        return activeFromCategories.length > 0 ? activeFromCategories : normalizedHeaderCategories;
    }, [categories, normalizedHeaderCategories]);

    const displayCategories = useMemo(() => {
        const allActive = sourceCategories;
        const pinned = normalizedHeaderCategories;

        const pinnedIds = new Set(pinned.map(cat => String(cat.id || cat._id)));
        const remaining = allActive.filter(cat => !pinnedIds.has(String(cat.id || cat._id)));

        return [...pinned, ...remaining];
    }, [sourceCategories, normalizedHeaderCategories]);

    const [selectedCategory, setSelectedCategory] = useState(null);

    const activeData = useMemo(() => {
        return sourceCategories.find(cat => String(cat.id || cat._id) === String(selectedCategory));
    }, [sourceCategories, selectedCategory]);

    // Use cached subcategories hook
    const dbId = activeData?._id || activeData?.id;
    const { subCategories, loading: subLoading } = useSubCategoriesByCategory(dbId);

    useEffect(() => {
        if (displayCategories.length > 0 && !selectedCategory) {
            setSelectedCategory(displayCategories[0]?.id || displayCategories[0]?._id);
        }
    }, [displayCategories, selectedCategory]);

    useEffect(() => {
        if (displayCategories.length === 0) return;

        const schedule = (work) => {
            if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
                return window.requestIdleCallback(work, { timeout: 1200 });
            }
            return setTimeout(work, 120);
        };

        const taskId = schedule(() => {
            displayCategories.slice(0, 12).forEach((cat) => {
                const categoryImage = cat?.image || cat?.icon || '';
                if (isImageSource(categoryImage)) {
                    prefetchThumbnail(categoryImage, 96);
                }
            });

            (subCategories || []).slice(0, 12).forEach((sub) => {
                if (sub?.image) {
                    prefetchThumbnail(sub.image, 128);
                }
            });
        });

        return () => {
            if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(taskId);
            } else {
                clearTimeout(taskId);
            }
        };
    }, [displayCategories, activeData, selectedCategory, subCategories]);

    const iconMap = {
        'grid_view': MdGridView,
        'checkroom': MdCheckroom,
        'smartphone': MdSmartphone,
        'face': MdFace,
        'laptop': MdLaptop,
        'home': MdHome,
        'shopping_basket': MdShoppingBasket,
    };
    const isImageSource = (value = '') => /^(https?:\/\/|\/|data:|blob:)/i.test(String(value || '').trim());

    if (displayCategories.length === 0 && (categoriesLoading || headerLoading)) {
        return <AllCategoriesSkeleton />;
    }

    return (
        <div className="bg-white min-h-screen flex flex-col md:pb-0">
            <div className="bg-white sticky top-0 z-10 px-3 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold text-gray-800">All Categories</h1>
                </div>
            </div>

            <div className="flex flex-1">
                <div className="w-1/4 max-w-[100px] bg-gray-50 border-r border-gray-200 no-scrollbar">
                    {displayCategories.map((cat) => {
                        const IconComponent = iconMap[cat.icon] || MdGridView;
                        const categoryImage = cat.image || cat.icon || '';
                        const hasCategoryImage = isImageSource(categoryImage);
                        const isSelected = selectedCategory === (cat.id || cat._id);
                        const isForYou = String(cat.name || '').trim().toLowerCase() === 'for you';
                        return (
                            <div
                                key={cat.id || cat._id}
                                onClick={() => setSelectedCategory(cat.id || cat._id)}
                                className={`flex flex-col items-center justify-center py-4 px-1 cursor-pointer relative ${isSelected ? 'bg-white' : ''}`}
                            >
                                {isSelected && !isForYou && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-600 rounded-r-full"></div>
                                )}

                                <div className={`relative w-12 h-12 rounded-full flex items-center justify-center mb-1 border transition-all ${isSelected && !isForYou ? 'bg-primary-50 text-primary-600 border-primary-200 scale-105 shadow-sm' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                    {hasCategoryImage ? (
                                        <CircleImage
                                            src={categoryImage}
                                            alt={cat.name}
                                            sizeClass="w-full h-full"
                                            thumbSize={96}
                                            priority={isSelected}
                                            fallback={<IconComponent className="text-2xl" />}
                                        />
                                    ) : (
                                        <IconComponent className="text-2xl" />
                                    )}
                                </div>
                                <span className={`text-[10px] text-center font-medium leading-tight px-1 ${isSelected && !isForYou ? 'text-primary-600 font-bold' : 'text-gray-500'}`}>
                                    {cat.name}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className="flex-1 bg-white p-4">
                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                        <h3 className="font-bold text-gray-800 mb-3 text-sm">Shop by Category</h3>

                        {subLoading && (!subCategories || subCategories.length === 0) ? (
                            <div className="grid grid-cols-3 gap-3">
                                {Array.from({ length: 9 }).map((_, idx) => (
                                    <div key={idx} className="flex flex-col items-center gap-2">
                                        <div className="w-16 h-16 rounded-full shimmer" />
                                        <div className="h-2.5 w-14 rounded shimmer" />
                                    </div>
                                ))}
                            </div>
                        ) : subCategories && subCategories.length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                                {subCategories.map((sub, index) => {
                                    const subKey = sub._id || sub.id || `${sub.name}-${index}`;
                                    return (
                                        <div
                                            key={subKey}
                                            onClick={() =>
                                                navigate(
                                                    `/category/${encodeURIComponent(activeData?.name || '')}/${encodeURIComponent(sub.name)}`
                                                )
                                            }
                                            className="flex flex-col items-center gap-2 cursor-pointer group animate-in fade-in zoom-in-95 duration-200"
                                        >
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 p-1 group-hover:border-primary-300 transition-all shadow-sm">
                                                <CircleImage
                                                    src={sub.image}
                                                    alt={sub.name}
                                                    sizeClass="w-full h-full"
                                                    thumbSize={128}
                                                    priority={index < 9}
                                                    fallback={<div className="w-full h-full rounded-full bg-gray-200" />}
                                                />
                                            </div>
                                            <span className="text-[10px] font-medium text-center text-gray-700 leading-tight group-hover:text-primary-600">
                                                {sub.name}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-400 text-sm">
                                No subcategories found.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AllCategories;
