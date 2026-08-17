import React, { useState, useRef, useEffect } from 'react';
import {
    MdEdit,
    MdSave,
    MdClose,
    MdAdd,
    MdDelete,
    MdSearch,
    MdCloudUpload,
    MdArrowBack,
    MdLink,
    MdImage,
    MdDragIndicator,
    MdLocalOffer
} from 'react-icons/md';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import useBannerStore from '../../store/bannerStore';
import useProductStore from '../../store/productStore';
import API from '../../../../services/api';
import { matchesNormalizedSearch } from '../../utils/search';

// DnD Kit imports
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// react-draggable removed

// Sortable Slide Item Component
const SortableSlide = ({ slide, index, onRemove, onUpdate, offers, onProductPick }) => {
    const mobileFileInputRef = useRef(null);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: slide.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-white rounded-xl border border-gray-100 shadow-sm relative group ${isDragging ? 'shadow-xl ring-2 ring-primary-400' : ''}`}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-2 left-2 z-20 p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:bg-gray-100 transition"
            >
                <MdDragIndicator size={16} className="text-gray-400" />
            </div>

            {/* Slide Number Badge */}
            <div className="absolute top-2 left-10 z-20 bg-primary-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                #{index + 1}
            </div>

            {/* Image Preview */}
            <div className="overflow-hidden px-2 pt-2">
                <img src={slide.preview || slide.imageUrl} className="h-24 w-full rounded-lg object-cover" alt="" />
            </div>

            {/* Slide Config */}
            <div className="p-2.5 space-y-2">
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Mobile Image</label>
                        <div className="flex items-center gap-1">
                            {!(slide.mobilePreview || slide.mobileImageUrl) && (
                                <button
                                    type="button"
                                    onClick={() => mobileFileInputRef.current?.click()}
                                    className="rounded-md border border-gray-200 bg-gray-50 p-1 text-primary-600 transition hover:border-primary-300 hover:bg-primary-50"
                                    title="Add mobile image"
                                >
                                    <MdAdd size={14} />
                                </button>
                            )}
                            {(slide.mobilePreview || slide.mobileImageUrl) && (
                                <button
                                    type="button"
                                    onClick={() => onUpdate(index, { mobileImageUrl: '', mobilePreview: undefined, mobileFile: undefined })}
                                    className="rounded-md border border-gray-200 bg-gray-50 p-1 text-red-500 transition hover:border-red-200 hover:bg-red-50"
                                    title="Remove mobile image"
                                >
                                    <MdDelete size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    <input
                        ref={mobileFileInputRef}
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            onUpdate(index, {
                                mobileImageUrl: `SLIDE_MOBILE_IMG_INDEX::${index}`,
                                mobilePreview: URL.createObjectURL(file),
                                mobileFile: file
                            });
                            e.target.value = '';
                        }}
                    />
                    {(slide.mobilePreview || slide.mobileImageUrl) && (
                        <div className="mt-2 overflow-hidden">
                            <img
                                src={slide.mobilePreview || slide.mobileImageUrl}
                                className="h-24 w-full rounded-lg object-cover"
                                alt=""
                            />
                        </div>
                    )}
                </div>
                <label className="text-[9px] font-bold text-gray-400 uppercase">Click Action</label>
                <div className="flex gap-1">
                    {['product', 'offer', 'url'].map(type => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => onUpdate(index, { targetType: type })}
                            className={`flex-1 py-1 px-2 rounded text-[9px] font-bold transition ${
                                slide.targetType === type
                                    ? type === 'product' ? 'bg-primary-100 text-primary-700'
                                        : type === 'offer' ? 'bg-green-100 text-green-700'
                                            : 'bg-purple-100 text-purple-700'
                                    : 'bg-gray-50 text-gray-400'
                            }`}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Conditional Inputs */}
                {slide.targetType === 'offer' && (
                    <select
                        value={slide.linkedOffer || ''}
                        onChange={(e) => {
                            const selectedOffer = offers.find(o => o._id === e.target.value);
                            const updates = { linkedOffer: e.target.value };
                            if (selectedOffer?.bannerImage) {
                                updates.imageUrl = selectedOffer.bannerImage;
                                updates.preview = selectedOffer.bannerImage;
                            }
                            onUpdate(index, updates);
                        }}
                        className="w-full rounded border border-gray-200 bg-white p-1.5 text-[10px] text-gray-900 outline-none dark:border-zinc-700 dark:bg-white dark:text-gray-900"
                        style={{ colorScheme: 'light' }}
                    >
                        <option value="">Select Offer...</option>
                        {offers.map(offer => (
                            <option key={offer._id} value={offer._id}>
                                {offer.title} ({offer.discountType === 'percentage' ? `${offer.discountValue}%` : `₹${offer.discountValue}`} OFF)
                            </option>
                        ))}
                    </select>
                )}
                {slide.targetType === 'product' && (
                    <button
                        type="button"
                        onClick={() => onProductPick(index)}
                        className="w-full rounded border border-gray-200 bg-gray-50 p-1.5 text-left text-[10px] text-gray-900 hover:bg-gray-100 truncate dark:border-zinc-700 dark:bg-white dark:text-gray-900"
                    >
                        {slide.linkedProduct ? slide.linkedProduct.name : 'Select Product...'}
                    </button>
                )}
                {slide.targetType === 'url' && (
                    <input
                        type="text"
                        placeholder="https://..."
                        value={slide.linkedUrl || ''}
                        onChange={(e) => onUpdate(index, { linkedUrl: e.target.value })}
                        className="w-full rounded border border-gray-200 p-1.5 text-[10px] text-gray-900 placeholder-gray-400 outline-none dark:border-zinc-700 dark:bg-white dark:text-gray-900"
                        style={{ colorScheme: 'light' }}
                    />
                )}

                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="w-full rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-red-600 transition hover:bg-red-100"
                >
                    Delete Slide
                </button>
            </div>
        </div>
    );
};




const HomeBanners = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const { banners, addBanner, updateBanner, deleteBanner, fetchBanners } = useBannerStore();
    const { products, fetchProducts } = useProductStore();
    const [offers, setOffers] = useState([]);

    console.log('HomeBanners State:', { bannersCount: banners.length, view: searchParams.get('view'), bannerId: searchParams.get('id') });

    useEffect(() => {
        fetchBanners();
        fetchProducts();
        API.get('/offers').then(({ data }) => setOffers(data)).catch(console.error);
    }, [fetchBanners, fetchProducts]);
    
    useEffect(() => {
        const view = searchParams.get('view');
        const bannerId = searchParams.get('id');
        
        if (view === 'edit' && bannerId && banners.length > 0) {
            const banner = banners.find(b => (b.id || b._id) === bannerId);
            if (banner) {
                console.log('Editing Banner:', banner); // DEBUG LOG
                setFormData({
                    ...banner,
                    slides: (banner.slides || []).map((s, i) => ({
                        ...s,
                        id: s.id || `slide-${i}-${Date.now()}`,
                        mobileImageUrl: s.mobileImageUrl || ''
                    })),
                    content: {
                        // Preserve ALL content fields
                        brand: banner.content?.brand || '',
                        brandTag: banner.content?.brandTag || '',
                        title: banner.content?.title || '',
                        subtitle: banner.content?.subtitle || '',
                        description: banner.content?.description || '',
                        imageUrl: banner.content?.imageUrl || '',
                        backgroundImageUrl: banner.content?.backgroundImageUrl || banner.content?.imageUrl || '',
                        mobileBackgroundImageUrl: banner.content?.mobileBackgroundImageUrl || '',
                        badgeText: banner.content?.badgeText || '',
                        offerText: banner.content?.offerText || '',
                        offerBank: banner.content?.offerBank || '',
                        backgroundColor: banner.content?.backgroundColor || '',
                        textColor: banner.content?.textColor || '',
                        textAlign: banner.content?.textAlign || 'left',
                        verticalAlign: banner.content?.verticalAlign || 'center',
                        imageAlign: banner.content?.imageAlign || 'right',
                        buttonText: banner.content?.buttonText || '',
                        link: banner.content?.link || '',
                        linkedProduct: banner.content?.linkedProduct || null,
                        linkedOffer: banner.content?.linkedOffer || null,
                        targetType: banner.content?.targetType || 'product',
                        // Custom positioning fields
                        useCustomPosition: banner.content?.useCustomPosition || false,
                        textPosition: banner.content?.textPosition || { x: 10, y: 50 },
                        imagePosition: banner.content?.imagePosition || { x: 70, y: 50 },
                        featuredProducts: banner.content?.featuredProducts || []
                    }
                });
                setHeroImagePreview(banner.content?.imageUrl || '');
                setBackgroundImagePreview(banner.content?.backgroundImageUrl || banner.content?.imageUrl || '');
                setBackgroundMobileImagePreview(banner.content?.mobileBackgroundImageUrl || '');
            }
        } else if (view === 'new') {
            setFormData({ 
                section: 'HomeHero', type: 'slides', active: true, slides: [],
                content: {
                    brand: '', brandTag: '', title: '', subtitle: '', description: '',
                    imageUrl: '', backgroundImageUrl: '', mobileBackgroundImageUrl: '', badgeText: '', offerText: '', offerBank: '',
                    backgroundColor: '', textColor: '', textAlign: 'left', verticalAlign: 'center',
                    imageAlign: 'right', buttonText: '', link: '', linkedProduct: null, linkedOffer: null,
                    targetType: 'product', useCustomPosition: false,
                    textPosition: { x: 10, y: 50 }, imagePosition: { x: 70, y: 50 }, featuredProducts: []
                }
            });
            setHeroImageFile(null);
            setHeroImagePreview('');
            setBackgroundImageFile(null);
            setBackgroundImagePreview('');
            setBackgroundMobileImageFile(null);
            setBackgroundMobileImagePreview('');
        }
    }, [searchParams, banners]);

    const showForm = searchParams.get('view') === 'edit' || searchParams.get('view') === 'new';
    const selectedBannerId = searchParams.get('id') || 'new';

    const [formData, setFormData] = useState({
        section: 'HomeHero',
        type: 'slides',
        active: true,
        slides: [],
        content: {
            brand: '', brandTag: '', title: '', subtitle: '', description: '',
            imageUrl: '', backgroundImageUrl: '', mobileBackgroundImageUrl: '', badgeText: '', offerText: '', offerBank: '', backgroundColor: '',
            buttonText: '',
            useCustomPosition: true,
            textPosition: { x: 10, y: 50 },
            imagePosition: { x: 70, y: 50 },
            featuredProducts: []
        }
    });

    const [heroImageFile, setHeroImageFile] = useState(null);
    const [heroImagePreview, setHeroImagePreview] = useState('');
    const [backgroundImageFile, setBackgroundImageFile] = useState(null);
    const [backgroundImagePreview, setBackgroundImagePreview] = useState('');
    const [backgroundMobileImageFile, setBackgroundMobileImageFile] = useState(null);
    const [backgroundMobileImagePreview, setBackgroundMobileImagePreview] = useState('');
    const [showProductPicker, setShowProductPicker] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);
    const heroFileInputRef = useRef(null);
    const bgFileInputRef = useRef(null);
    // Refs for Draggable components
    const featuredProductRefs = useRef([]);

    // DnD Kit sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            const oldIndex = formData.slides.findIndex(s => s.id === active.id);
            const newIndex = formData.slides.findIndex(s => s.id === over.id);
            setFormData(prev => ({
                ...prev,
                slides: arrayMove(prev.slides, oldIndex, newIndex)
            }));
        }
    };

    const handleAddSlide = (e) => {
        const files = Array.from(e.target.files);
        const newSlides = files.map((file, i) => ({
            id: `slide-${Date.now()}-${i}`,
            imageUrl: 'SLIDE_IMG_INDEX::' + (formData.slides.length + i),
            originalName: file.name,
            preview: URL.createObjectURL(file),
            file: file,
            linkedProduct: null,
            targetType: 'product',
            linkedOffer: null,
            linkedUrl: ''
        }));
        setFormData(prev => ({ ...prev, slides: [...prev.slides, ...newSlides] }));
        e.target.value = '';
    };

    const handleHeroImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setHeroImageFile(file);
        setHeroImagePreview(URL.createObjectURL(file));
    };

    const handleBgImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setBackgroundImageFile(file);
        setBackgroundImagePreview(URL.createObjectURL(file));
    };

    const handleMobileBgImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setBackgroundMobileImageFile(file);
        setBackgroundMobileImagePreview(URL.createObjectURL(file));
    };

    const removeSlide = (index) => {
        setFormData(prev => ({ ...prev, slides: prev.slides.filter((_, i) => i !== index) }));
    };

    const updateSlide = (index, updates) => {
        setFormData(prev => {
            const newSlides = [...prev.slides];
            newSlides[index] = { ...newSlides[index], ...updates };
            return { ...prev, slides: newSlides };
        });
    };

    const handleSaveBanner = async () => {
        setIsSaving(true);
        const loadingToast = toast.loading('Saving banner...');
        
        try {
            const data = new FormData();
            data.append('section', formData.section);
            data.append('type', formData.type);
            data.append('active', String(formData.active));

            if (formData.type === 'slides') {
                let uploadedFileIndex = 0;
                let uploadedMobileFileIndex = 0;
                const slidesMetadata = formData.slides.map((s) => {
                    if (s.file) {
                        const currentFileIndex = uploadedFileIndex;
                        uploadedFileIndex += 1;
                        const metadata = {
                            ...s, 
                            imageUrl: `SLIDE_IMG_INDEX::${currentFileIndex}`, 
                            targetType: s.targetType || 'product',
                            linkedOffer: s.linkedOffer || null,
                            linkedUrl: s.linkedUrl || '',
                            file: undefined, 
                            preview: undefined,
                            mobileFile: undefined,
                            mobilePreview: undefined
                        };
                        if (s.mobileFile) {
                            metadata.mobileImageUrl = `SLIDE_MOBILE_IMG_INDEX::${uploadedMobileFileIndex}`;
                            uploadedMobileFileIndex += 1;
                        }
                        return metadata; 
                    }
                    const metadata = { ...s, file: undefined, preview: undefined, mobileFile: undefined, mobilePreview: undefined };
                    if (s.mobileFile) {
                        metadata.mobileImageUrl = `SLIDE_MOBILE_IMG_INDEX::${uploadedMobileFileIndex}`;
                        uploadedMobileFileIndex += 1;
                    }
                    return metadata;
                });

                data.append('slides', JSON.stringify(slidesMetadata));
                
                formData.slides.forEach((s) => {
                    if (s.file) {
                        data.append('slide_images', s.file);
                    }
                    if (s.mobileFile) {
                        data.append('slide_mobile_images', s.mobileFile);
                    }
                });
            } else {
                data.append('content', JSON.stringify(formData.content));
                if (heroImageFile) {
                    data.append('hero_image', heroImageFile);
                } else if (formData.content.imageUrl) {
                    data.append('hero_image_url', formData.content.imageUrl);
                }

                if (backgroundImageFile) {
                    data.append('background_image', backgroundImageFile);
                } else if (formData.content.backgroundImageUrl) {
                    data.append('background_image_url', formData.content.backgroundImageUrl);
                }

                if (backgroundMobileImageFile) {
                    data.append('background_mobile_image', backgroundMobileImageFile);
                } else if (formData.content.mobileBackgroundImageUrl) {
                    data.append('background_mobile_image_url', formData.content.mobileBackgroundImageUrl);
                }
            }

            if (selectedBannerId && selectedBannerId !== 'new') {
                await updateBanner(selectedBannerId, data);
            } else {
                await addBanner(data);
            }
            
            await fetchBanners();
            toast.success('Banner saved successfully!', { id: loadingToast });
            navigate('/admin/content/banners');
            
        } catch (error) {
            console.error(error);
            toast.error(error.message || 'Failed to save banner', { id: loadingToast });
        } finally {
            setIsSaving(false);
        }
    };

    const openNewBannerForm = () => {
        setFormData({ 
            section: 'HomeHero', type: 'slides', active: true, slides: [],
            content: { brand: '', brandTag: '', title: '', subtitle: '', description: '', imageUrl: '', backgroundImageUrl: '', mobileBackgroundImageUrl: '', badgeText: '', offerText: '', offerBank: '', backgroundColor: '' } 
        }); 
        setHeroImageFile(null);
        setHeroImagePreview('');
        setBackgroundImageFile(null);
        setBackgroundImagePreview('');
        setBackgroundMobileImageFile(null);
        setBackgroundMobileImagePreview('');
        setSearchParams({ view: 'new' });
    };

    const handleEdit = (banner) => {
        setFormData({
            ...banner,
            slides: (banner.slides || []).map((s, i) => ({ ...s, id: s.id || `slide-${i}-${Date.now()}`, mobileImageUrl: s.mobileImageUrl || '' })),
            content: banner.content || {
                brand: '', brandTag: '', title: '', subtitle: '', description: '',
                imageUrl: '', backgroundImageUrl: '', mobileBackgroundImageUrl: '', badgeText: '', offerText: '', offerBank: '', backgroundColor: ''
            }
        });
        setHeroImagePreview(banner.content?.imageUrl || '');
        setBackgroundImagePreview(banner.content?.backgroundImageUrl || banner.content?.imageUrl || '');
        setBackgroundMobileImagePreview(banner.content?.mobileBackgroundImageUrl || '');
        setSearchParams({ view: 'edit', id: banner.id || banner._id });
    };

    const handleAttachProduct = (slideIndex, product) => {
        // Handle featured products for hero banner
        if (slideIndex === 'featured') {
            const newFeaturedProduct = {
                productId: product._id || product.id,
                position: {
                    x: 15 + ((formData.content.featuredProducts?.length || 0) * 20), // Stagger horizontally
                    y: 70 // Bottom area
                }
            };
            setFormData({
                ...formData,
                content: {
                    ...formData.content,
                    featuredProducts: [...(formData.content.featuredProducts || []), newFeaturedProduct]
                }
            });
        } else if (slideIndex === 'hero') {
            setFormData(prev => ({
                ...prev,
                content: { ...prev.content, linkedProduct: product }
            }));
        } else {
            updateSlide(slideIndex, { linkedProduct: product });
        }
        setShowProductPicker(null);
    };

    const filteredProducts = products.filter(p =>
        matchesNormalizedSearch(p.name, searchTerm)
    );

    // --- Main List View ---
    if (!showForm) {
        return (
            <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex justify-end">
                    <button
                        onClick={openNewBannerForm}
                        className="px-4 py-2 bg-purple-600 text-white rounded-xl text-[10px] font-bold hover:bg-purple-700 transition shadow-sm"
                    >
                        NEW BANNER
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {banners.map((banner) => (
                        <div 
                            key={banner.id || banner._id} 
                            onClick={() => console.log('Banner List Item Click:', banner)}
                            className="group bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition cursor-pointer"
                        >
                            <div className="h-32 bg-gray-50 border-b border-gray-50 relative overflow-hidden">
                                {banner.type === 'hero' ? (
                                    <img 
                                        src={banner.content?.backgroundImageUrl || banner.content?.imageUrl} 
                                        className="w-full h-full object-cover" 
                                        alt="" 
                                        onError={(e) => console.error('Banner List Thumb Error (Hero):', banner._id, e.target.src)}
                                    />
                                ) : (
                                    <img 
                                        src={banner.slides?.[0]?.imageUrl} 
                                        className="w-full h-full object-cover opacity-80" 
                                        alt="" 
                                        onError={(e) => console.error('Banner List Thumb Error (Slides):', banner._id, e.target.src)}
                                    />
                                )}
                                <div className="absolute top-2 right-2 flex gap-1">
                                     <span className="bg-black/60 text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase">{banner.type}</span>
                                     <span className="bg-primary-600/80 text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase">{banner.section}</span>
                                </div>
                            </div>
                            <div className="p-4 flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase">{banner.type === 'hero' ? banner.content?.brand : `${banner.slides.length} Slides`}</p>
                                    <h3 className="text-sm font-black text-gray-800 truncate uppercase tracking-tight">{banner.type === 'hero' ? banner.content?.title : 'Slideshow'}</h3>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEdit(banner)} className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"><MdEdit size={16} /></button>
                                    <button onClick={() => deleteBanner(banner.id || banner._id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition"><MdDelete size={16} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {banners.length === 0 && <div className="col-span-full py-12 text-center text-xs text-gray-400 font-bold border-2 border-dashed border-gray-100 rounded-xl">No banners found.</div>}
                </div>
            </div>
        );
    }

    // --- Create / Edit Form ---
    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm sticky top-4 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={() => setSearchParams({})} className="text-gray-400 hover:text-gray-600"><MdArrowBack size={24} /></button>
                    <h2 className="text-lg font-black text-gray-800 tracking-tight">{selectedBannerId === 'new' ? 'New Banner' : 'Edit Banner'}</h2>
                </div>
                <button 
                    onClick={handleSaveBanner} 
                    disabled={isSaving}
                    className="px-8 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-black hover:bg-primary-700 transition shadow-lg shadow-primary-200 uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                </button>
            </div>

            {/* Two Column Layout for Slides */}
            {formData.type === 'slides' && (
                <div className="space-y-6">
                    {/* Left: Slide Editor */}
                    <div className="space-y-4">
                        {/* Draggable Slides Grid */}
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <MdDragIndicator className="text-gray-400" />
                                    Slides ({formData.slides.length}) - Drag to reorder
                                </h3>
                            </div>

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext items={formData.slides.map(s => s.id)} strategy={rectSortingStrategy}>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {formData.slides.map((slide, idx) => (
                                            <SortableSlide
                                                key={slide.id}
                                                slide={slide}
                                                index={idx}
                                                onRemove={removeSlide}
                                                onUpdate={updateSlide}
                                                offers={offers}
                                                onProductPick={() => setShowProductPicker(idx)}
                                            />
                                        ))}
                                        
                                        {/* Add Slide Button */}
                                        <button
                                            onClick={() => fileInputRef.current.click()}
                                            className="h-48 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 flex flex-col items-center justify-center hover:border-primary-300 hover:bg-primary-50/30 transition group"
                                        >
                                            <input type="file" ref={fileInputRef} hidden multiple onChange={handleAddSlide} accept="image/*" />
                                            <MdAdd size={32} className="text-gray-300 group-hover:text-primary-400 transition" />
                                            <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase group-hover:text-primary-500">Add Slides</span>
                                        </button>
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero Form with Alignment Controls & Preview */}
            {formData.type === 'hero' && (
                <div className="space-y-6">
                    {/* Configuration & Content */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
                        {/* Image Upload & Click Action */}
                        <div className="space-y-4">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left Column: Image Uploads */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Web Banner Image</label>
                                        <label className="block w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 transition cursor-pointer relative overflow-hidden group">
                                            {backgroundImagePreview ? (
                                                <img src={backgroundImagePreview} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                                                    <MdCloudUpload size={32} />
                                                    <span className="text-[10px] font-bold mt-1">Upload Image</span>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition">Change</div>
                                            <input type="file" ref={bgFileInputRef} hidden onChange={handleBgImageUpload} accept="image/*" />
                                        </label>
                                        {backgroundImagePreview && (
                                            <button 
                                                onClick={(e) => { e.preventDefault(); setBackgroundImageFile(null); setBackgroundImagePreview(''); setFormData({...formData, content: {...formData.content, backgroundImageUrl: ''}})}}
                                                className="w-full py-1 text-[10px] text-red-500 font-bold hover:bg-red-50 rounded transition"
                                            >
                                                REMOVE WEB IMAGE
                                            </button>
                                        )}
                                    </div>

                                    <label className="block w-full aspect-video rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-400 hover:bg-purple-50/50 transition cursor-pointer relative overflow-hidden group">
                                        {backgroundMobileImagePreview ? (
                                            <img src={backgroundMobileImagePreview} className="w-full h-full object-cover" alt="" />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                                                <MdCloudUpload size={32} />
                                                <span className="text-[10px] font-bold mt-1">Upload Mobile Image</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs transition">Change</div>
                                        <input type="file" hidden onChange={handleMobileBgImageUpload} accept="image/*" />
                                    </label>
                                    {backgroundMobileImagePreview && (
                                        <button 
                                            onClick={(e) => { e.preventDefault(); setBackgroundMobileImageFile(null); setBackgroundMobileImagePreview(''); setFormData({...formData, content: {...formData.content, mobileBackgroundImageUrl: ''}})}}
                                            className="w-full py-1 text-[10px] text-red-500 font-bold hover:bg-red-50 rounded transition"
                                        >
                                            REMOVE MOBILE IMAGE
                                        </button>
                                    )}
                                </div>

                                {/* Right Column: Click Action */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Click Action</label>
                                        <div className="flex gap-1">
                                            {['product', 'offer', 'url'].map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setFormData({...formData, content: {...formData.content, targetType: type}})}
                                                    className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-bold transition ${
                                                        (formData.content.targetType || 'product') === type
                                                            ? type === 'product' ? 'bg-primary-100 text-primary-700 border border-primary-200'
                                                                : type === 'offer' ? 'bg-green-100 text-green-700 border border-green-200'
                                                                    : 'bg-purple-100 text-purple-700 border border-purple-200'
                                                            : 'bg-gray-50 text-gray-400 border border-transparent'
                                                    }`}
                                                >
                                                    {type.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Details Input */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">
                                            {formData.content.targetType === 'product' ? 'Select Product' : 
                                             formData.content.targetType === 'offer' ? 'Select Offer' : 'External URL'}
                                        </label>
                                        
                                        {formData.content.targetType === 'offer' && (
                                            <select
                                                value={formData.content.linkedOffer || ''}
                                                onChange={(e) => setFormData({...formData, content: {...formData.content, linkedOffer: e.target.value}})}
                                                className="w-full p-2.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-800 outline-none focus:ring-2 focus:ring-primary-100"
                                            >
                                                <option value="">Select an Offer...</option>
                                                {offers.map(offer => (
                                                    <option key={offer._id} value={offer._id}>
                                                        {offer.title}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        {formData.content.targetType === 'product' && (
                                            <button
                                                type="button"
                                                onClick={() => setShowProductPicker('hero')}
                                                className="w-full p-2.5 text-xs bg-white border border-gray-200 rounded-lg text-left hover:bg-gray-50 truncate text-gray-800 flex justify-between items-center"
                                            >
                                                <span>{formData.content.linkedProduct ? formData.content.linkedProduct.name : 'Select a Product...'}</span>
                                                <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">BROWSE</span>
                                            </button>
                                        )}
                                        {formData.content.targetType === 'url' && (
                                            <input
                                                type="text"
                                                placeholder="https://example.com/promo"
                                                value={formData.content.link || ''}
                                                onChange={(e) => setFormData({...formData, content: {...formData.content, link: e.target.value}})}
                                                className="w-full p-2.5 text-xs border border-gray-200 rounded-lg text-gray-800 placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-100"
                                            />
                                        )}
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>

                </div>
            )}


            {/* Product Picker Modal */}
            {showProductPicker !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProductPicker(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[70vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                            <MdSearch className="text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400"
                                autoFocus
                            />
                            <button onClick={() => setShowProductPicker(null)} className="p-1 hover:bg-gray-100 rounded"><MdClose /></button>
                        </div>
                        <div className="overflow-y-auto max-h-[50vh] p-2">
                            {filteredProducts.slice(0, 20).map(product => (
                                <div
                                    key={product._id}
                                    onClick={() => handleAttachProduct(showProductPicker, product)}
                                    className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                                >
                                    <img src={product.images?.[0]} className="w-10 h-10 object-cover rounded" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                                        <p className="text-xs text-gray-400">₹{product.price}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomeBanners;
