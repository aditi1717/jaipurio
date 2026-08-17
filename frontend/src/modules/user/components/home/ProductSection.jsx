import React from 'react';
import ProductCard from '../product/ProductCard';
import { useGoogleTranslation } from '../../../../hooks/useGoogleTranslation';

const ProductSection = ({
    title,
    subtitle,
    titleBadge,
    products = [],
    onViewAll,
    showArrow = true,
    containerClass = "mt-6",
    isScrollable = true,
    loading = false
}) => {
    const scrollRef = React.useRef(null);
    const skeletonItems = [1, 2, 3, 4, 5, 6];
    const normalizedProducts = React.useMemo(() => {
        return (products || []).map((product) => {
            const firstSku = Array.isArray(product?.skus) && product.skus.length > 0 ? product.skus[0] : null;
            const price = Number(firstSku?.price ?? product?.price ?? 0);
            const originalPrice = Number(firstSku?.originalPrice ?? product?.originalPrice ?? price);

            return {
                ...product,
                price,
                originalPrice
            };
        });
    }, [products]);
    
    // Translate Title and Subtitle
    const translatedTitle = useGoogleTranslation(title);
    const translatedSubtitle = useGoogleTranslation(subtitle);

    const scroll = (direction) => {
        if (scrollRef.current) {
            const { current } = scrollRef;
            const scrollAmount = current.clientWidth / 2;
            current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <section className={`${containerClass}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[15px] md:text-2xl font-bold text-gray-900">{translatedTitle}</h3>
                        {titleBadge && (
                            <span className="bg-gray-100 text-gray-500 text-[9px] md:text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                {titleBadge}
                            </span>
                        )}
                    </div>
                    {subtitle && <p className="text-[9px] md:text-sm text-gray-500 font-medium -mt-0.5">{translatedSubtitle}</p>}
                </div>
                {onViewAll && showArrow && (
                    <button
                        onClick={onViewAll}
                        className="bg-primary-600 text-white rounded-full w-7 h-7 md:w-10 md:h-10 flex items-center justify-center hover:bg-primary-700 transition-colors"
                    >
                        <span className="material-icons text-white text-base md:text-lg">arrow_forward</span>
                    </button>
                )}
            </div>

            {isScrollable ? (
                <div className="relative group/section">
                    {/* Left Scroll Button */}
                    <button
                        onClick={() => scroll('left')}
                        className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg items-center justify-center border border-gray-100 opacity-0 group/section:opacity-100 transition-opacity disabled:opacity-0 -ml-5"
                    >
                        <span className="material-icons text-gray-700">chevron_left</span>
                    </button>

                    <div ref={scrollRef} className="flex overflow-x-auto gap-2 md:gap-6 no-scrollbar pb-2 -mx-1 px-1 scroll-smooth">
                        {loading ? (
                            skeletonItems.map((i) => (
                                <div key={i} className="min-w-[130px] w-[130px] md:min-w-[240px] md:w-[240px] flex-shrink-0 animate-pulse">
                                    <div className="aspect-square bg-gray-100 rounded-2xl mb-3"></div>
                                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
                                    <div className="h-4 bg-gray-50 rounded w-1/2"></div>
                                </div>
                            ))
                        ) : (
                            normalizedProducts.map((product) => (
                                <div key={product.id || product._id} className="min-w-[130px] w-[130px] md:min-w-[240px] md:w-[240px] flex-shrink-0">
                                    <ProductCard product={product} />
                                </div>
                            ))
                        )}
                    </div>

                    {/* Right Scroll Button */}
                    <button
                        onClick={() => scroll('right')}
                        className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white rounded-full shadow-lg items-center justify-center border border-gray-100 opacity-0 group-hover/section:opacity-100 transition-opacity disabled:opacity-0 -mr-5"
                    >
                        <span className="material-icons text-gray-700">chevron_right</span>
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-6">
                    {normalizedProducts.map((product) => (
                        <ProductCard key={product.id || product._id} product={product} />
                    ))}
                </div>
            )}
        </section>
    );
};

export default ProductSection;
