import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { useGoogleTranslation } from '../../../../hooks/useGoogleTranslation';

const HomeBanner = ({ banner, isMobileViewport = false }) => {
    const navigate = useNavigate();
    const bannerFrameClass = 'w-full';
    const bannerImageClass = 'w-full h-auto object-contain object-center block rounded-xl';
    const getHeroImage = () => {
        if (isMobileViewport) {
            return (
                banner?.content?.mobileBackgroundImageUrl ||
                banner?.content?.backgroundImageUrl ||
                banner?.content?.imageUrl ||
                ''
            );
        }
        return banner?.content?.backgroundImageUrl || banner?.content?.imageUrl || '';
    };

    const getSlideImage = (slide) => {
        if (isMobileViewport) {
            return slide?.mobileImageUrl || slide?.imageUrl || '';
        }
        return slide?.imageUrl || '';
    };

    // Debugging Banner Data
    if (banner?.active && banner?.type === 'hero') {
        console.log('Banner Debug:', {
            id: banner._id,
            useCustomPosition: banner.content?.useCustomPosition,
            textPosition: banner.content?.textPosition,
            imagePosition: banner.content?.imagePosition
        });
    }

    if (!banner || !banner.active) return null;

    // Translation Hook for Content
    const translatedTitle = useGoogleTranslation(banner.content?.title);
    const translatedSubtitle = useGoogleTranslation(banner.content?.subtitle);
    const translatedDescription = useGoogleTranslation(banner.content?.description);
    const translatedOfferText = useGoogleTranslation(banner.content?.offerText);
    const translatedButtonText = useGoogleTranslation(banner.content?.buttonText);

    const handleSlideClick = (slide) => {
        const offerId = slide.linkedOffer?._id || slide.linkedOffer;
        const productId = slide.linkedProduct?._id || slide.linkedProduct;

        if (offerId) {
            navigate(`/offers/${offerId}`);
        } else if (productId) {
            navigate(`/product/${productId}`);
        } else if (slide.link) {
            if (slide.link.startsWith('http')) window.location.href = slide.link;
            else navigate(slide.link);
        }
    };

    const handleBannerContentClick = () => {
        const { content } = banner;
        const offerId = content?.linkedOffer?._id || content?.linkedOffer;
        const productId = content?.linkedProduct?._id || content?.linkedProduct;

        if (offerId) {
            navigate(`/offers/${offerId}`);
        } else if (productId) {
            navigate(`/product/${productId}`);
        } else if (content?.link) {
            if (content.link.startsWith('http')) window.location.href = content.link;
            else navigate(content.link);
        }
    };

    // --- Hero Banner Style ---
    if (banner.type === 'hero') {
        const { content } = banner;
        const textColor = content.textColor || '#ffffff';
        const bgColor = content.backgroundColor || '#1e3a5f';

        return (
            <section className="w-full">
                <div
                    onClick={handleBannerContentClick}
                    className={`relative ${bannerFrameClass} rounded-xl overflow-hidden group cursor-pointer`}
                    style={{ backgroundColor: bgColor }}
                >
                    {/* Background Image Layer */}
                    {getHeroImage() && (
                        <div className="relative w-full rounded-xl overflow-hidden">
                            <img
                                src={getHeroImage()}
                                className={`${bannerImageClass} group-hover:scale-[1.02] transition-transform duration-1000`}
                                alt=""
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                            />
                        </div>
                    )}
                </div>
            </section>
        );
    }

    // --- Card Style (Visual Image with Text Overlay) ---
    if (banner.type === 'card') {
        return (
            <section className="w-full">
                <div
                    onClick={handleBannerContentClick}
                    className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm cursor-pointer active:scale-[0.98] transition-transform group relative"
                >
                    <img
                        src={banner.content.imageUrl}
                        alt={banner.content.title}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        className="w-full h-auto block group-hover:scale-[1.02] transition-transform duration-700"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                        }}
                    />
                    <div className="absolute inset-0 bg-black/10 flex items-center p-4 md:p-6 bg-gradient-to-r from-black/40 to-transparent">
                        <div className="max-w-[80%]">
                            <h2 className="text-lg md:text-3xl font-black text-white uppercase tracking-tighter leading-none mb-1 group-hover:translate-x-2 transition-transform drop-shadow-md">
                                {translatedTitle}
                            </h2>
                            <p className="text-[10px] md:text-xl font-bold text-yellow-400 italic tracking-wide group-hover:translate-x-2 transition-transform delay-75 drop-shadow-md">
                                {translatedSubtitle || translatedOfferText}
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        );
    }

    // --- Product Feature Style (Sponsored / Special Layout) ---
    if (banner.type === 'product_feature') {
        return (
            <section className="w-full">
                <div className="flex items-center gap-2 mb-3 px-2">
                    <h3 className="text-lg md:text-2xl font-bold text-gray-900">Sponsored</h3>
                </div>
                <div
                    onClick={handleBannerContentClick}
                    className={`relative rounded-3xl overflow-hidden md:h-[300px] cursor-pointer group hover:shadow-xl transition-shadow ${banner.content.backgroundColor || 'bg-gradient-to-b from-white to-primary-100'} border border-primary-200`}
                >
                    <div className="absolute inset-0 p-4 md:p-12 flex items-center">
                        <div className="w-1/2 md:w-1/3 z-10">
                            {banner.content.brand && (
                                <h4 className="text-[#e67e22] text-[8px] md:text-sm font-black tracking-widest uppercase mb-1">{banner.content.brand}</h4>
                            )}
                            <h2 className="text-base md:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-1 md:mb-2 line-clamp-1 md:line-clamp-2">
                                {translatedTitle}
                            </h2>
                            <p className="text-[10px] md:text-lg font-bold text-gray-600 line-clamp-1 md:line-clamp-2">
                                {translatedDescription}
                            </p>
                            <button className="hidden md:block mt-6 bg-gray-900 text-white px-6 py-2 rounded-full font-bold hover:bg-black transition-colors">
                                Shop Now
                            </button>
                        </div>
                        <div className="w-1/2 md:w-2/3 h-full flex items-center justify-center relative">
                            {banner.content.imageUrl && (
                                <img
                                    src={banner.content.imageUrl}
                                    alt={banner.content.title}
                                    loading="lazy"
                                    decoding="async"
                                    fetchPriority="low"
                                    className="h-[80%] md:h-[120%] object-contain drop-shadow-2xl translate-x-4 group-hover:scale-105 transition-transform duration-500"
                                />
                            )}
                        </div>
                    </div>
                    {banner.content.offerText && (
                        <div className="absolute bottom-0 left-0 right-0 py-1.5 md:py-2.5 px-4 md:px-12 bg-[#ff6b35] flex items-center justify-between z-20">
                            <span className="text-white text-xs md:text-xl font-black">{translatedOfferText}</span>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className={`h-1 md:h-2 rounded-full ${i === 4 ? 'w-4 md:w-8 bg-white' : 'w-1 md:w-2 bg-white/40'}`} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        );
    }

    // --- Slideshow Style ---
    if (banner.type === 'slides' && banner.slides?.length > 0) {
        return (
            <section className="w-full">
                <Swiper
                    modules={[Autoplay, Pagination]}
                    autoplay={{ delay: 4000, disableOnInteraction: false }}
                    pagination={{ clickable: true }}
                    loop={true}
                    autoHeight={true}
                    className={`${bannerFrameClass} rounded-xl overflow-hidden group home-banner-swiper`}
                >
                    {banner.slides.map((slide, index) => (
                        <SwiperSlide key={index}>
                            <div
                                className="relative w-full cursor-pointer rounded-xl overflow-hidden"
                                onClick={() => handleSlideClick(slide)}
                            >
                                {getSlideImage(slide) ? (
                                    <img
                                        src={getSlideImage(slide)}
                                        className={bannerImageClass}
                                        alt={`Slide ${index + 1}`}
                                        loading={index === 0 ? 'eager' : 'lazy'}
                                        decoding="async"
                                        fetchPriority={index === 0 ? 'high' : 'low'}
                                    />
                                ) : (
                                    <div className="w-full min-h-[120px] rounded-xl bg-transparent" />
                                )}
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </section>
        );
    }

    // Fallback for missing slides or unknown type
    return (
        <div className="w-full h-24 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center text-gray-400 text-xs font-bold uppercase tracking-widest mt-4">
            Banner Content Coming Soon ({banner.type})
        </div>
    );
};

export default HomeBanner;
