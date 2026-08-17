import React from 'react';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    const pages = [];
    // Basic logic to show some pages. Can be improved for many pages.
    for (let i = 1; i <= totalPages; i++) {
        if (
            i === 1 ||
            i === totalPages ||
            (i >= currentPage - 1 && i <= currentPage + 1)
        ) {
            pages.push(i);
        } else if (
            (i === currentPage - 2 && currentPage > 3) ||
            (i === currentPage + 2 && currentPage < totalPages - 2)
        ) {
            pages.push('...');
        }
    }

    // Remove duplicates adjacent '...' if any (simple logic above might produce duplicates/overlaps ideally handled more strictly, but let's filter purely unique for now to be safe)
    const uniquePages = [...new Set(pages)];

    return (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <div className="text-sm text-gray-500">
                Page <span className="font-bold text-gray-800">{currentPage}</span> of <span className="font-bold text-gray-800">{totalPages}</span>
            </div>

            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all text-gray-600"
                >
                    <MdChevronLeft size={20} />
                </button>

                {uniquePages.map((page, idx) => (
                    <React.Fragment key={idx}>
                        {page === '...' ? (
                            <span className="px-2 text-gray-400 text-sm">...</span>
                        ) : (
                            <button
                                onClick={() => onPageChange(page)}
                                className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-bold transition-all ${currentPage === page
                                        ? 'bg-primary-600 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-white hover:border-gray-200 hover:shadow-sm border border-transparent'
                                    }`}
                            >
                                {page}
                            </button>
                        )}
                    </React.Fragment>
                ))}

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-md hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all text-gray-600"
                >
                    <MdChevronRight size={20} />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
