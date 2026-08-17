import React from 'react';

const CategoryDeals = ({ deals }) => {
    if (!deals || deals.length === 0) return null;

    return (
        <div className="bg-white dark:bg-zinc-900 py-2">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Featured Deals</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {deals.map((deal, index) => (
                    <div key={index} className="flex flex-col items-center cursor-pointer group">
                        {/* Card Container with Image and Price Banner */}
                        <div className="w-full rounded-xl border border-gray-100 dark:border-zinc-800 overflow-hidden flex flex-col mb-2 relative bg-white dark:bg-zinc-800 transition-all duration-300 group-hover:shadow-md group-hover:border-primary-200">
                            {/* Image Area */}
                            <div className="aspect-square bg-[#f8f9fb] dark:bg-zinc-700/30 flex items-center justify-center p-2">
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
                        {/* Product Name */}
                        <span className="text-[10px] md:text-xs text-center text-gray-700 dark:text-gray-400 font-bold leading-tight line-clamp-2 px-1 group-hover:text-primary-600">
                            {deal.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CategoryDeals;
