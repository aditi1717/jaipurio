import React from 'react';

const Pagination = ({ pages, page, changePage }) => {
    if (pages <= 1) return null;

    // Logic to show limited range of pages (e.g., 1 ... 4 5 6 ... 10)
    let startPage, endPage;
    if (pages <= 5) {
        startPage = 1;
        endPage = pages;
    } else {
        if (page <= 3) {
            startPage = 1;
            endPage = 5;
        } else if (page + 2 >= pages) {
            startPage = pages - 4;
            endPage = pages;
        } else {
            startPage = page - 2;
            endPage = page + 2;
        }
    }

    const pageNumbers = [...Array((endPage + 1) - startPage).keys()].map(i => startPage + i);

    return (
        pages > 1 && (
            <div className="flex justify-center mt-8 gap-2">
                <button
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                    disabled={page === 1}
                    onClick={() => changePage(page - 1)}
                >
                    Prev
                </button>

                {startPage > 1 && (
                    <>
                        <button 
                            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-100"
                            onClick={() => changePage(1)}
                        >
                            1
                        </button>
                        {startPage > 2 && <span className="px-2 py-2 text-gray-400">...</span>}
                    </>
                )}

                {pageNumbers.map((x) => (
                    <button
                        key={x}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${x === page
                            ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-200'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                        onClick={() => changePage(x)}
                    >
                        {x}
                    </button>
                ))}

                {endPage < pages && (
                    <>
                        {endPage < pages - 1 && <span className="px-2 py-2 text-gray-400">...</span>}
                        <button 
                            className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-bold hover:bg-gray-100"
                            onClick={() => changePage(pages)}
                        >
                            {pages}
                        </button>
                    </>
                )}

                <button
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${page === pages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}`}
                    disabled={page === pages}
                    onClick={() => changePage(page + 1)}
                >
                    Next
                </button>
            </div>
        )
    );
};

export default Pagination;
