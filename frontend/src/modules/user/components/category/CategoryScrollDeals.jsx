import React from 'react';
import { useNavigate } from 'react-router-dom';

const CategoryScrollDeals = ({ deals, title }) => {
    const navigate = useNavigate();
    if (!deals || deals.length === 0) return null;

    const handleDealClick = (deal) => {
        const params = new URLSearchParams();
        // Since deals in mockData might not have explicit category, we try to infer or pass it if available
        // Or if deals are generic, we might default to 'Top Deals' or similar if no category present
        if (deal.category) params.append('category', deal.category);

        // Some deals use 'name' as product name, some as category/deal name
        // We'll use name as subcategory/tag filter for now to find relevant products
        if (deal.name) params.append('subcategory', deal.name);

        navigate(`/products?${params.toString()}`);
    };

    return (
        <div className="bg-white dark:bg-zinc-900 py-2">
            {title && (
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">{title}</h3>
                </div>
            )}
            <div className="flex overflow-x-auto gap-4 no-scrollbar pb-2">
                {deals.map((deal, index) => (
                    <div
                        key={index}
                        onClick={() => handleDealClick(deal)}
                        className="flex-shrink-0 w-28 md:w-36 flex flex-col items-center cursor-pointer group"
                    >
                        {/* Card Container with Image and Price Banner */}
                        <div className="w-full rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col mb-2 relative bg-white dark:bg-zinc-800 transition-all duration-300 group-hover:shadow-md group-hover:border-primary-200">
                            {/* Image Area */}
                            <div className="h-28 md:h-36 bg-[#f8f9fb] dark:bg-zinc-700/30 flex items-center justify-center p-3">
                                <img
                                    src={deal.image}
                                    alt={deal.name}
                                    className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>
                            {/* Orange Price Banner */}
                            <div className="bg-[#fb641b] text-white text-[10px] md:text-xs font-black py-1 px-1 w-full text-center truncate italic">
                                {deal.offer}
                            </div>
                        </div>
                        {/* Product Name (Outside) */}
                        <span className="text-[10px] md:text-xs text-center text-gray-700 dark:text-gray-400 font-bold leading-tight line-clamp-2 px-1 group-hover:text-primary-600">
                            {deal.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CategoryScrollDeals;
