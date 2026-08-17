import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';

const Wishlist = () => {
    const navigate = useNavigate();
    const { wishlist, toggleWishlist, moveToCart } = useCartStore();

    return (
        <div className="bg-white min-h-screen md:bg-[#f1f3f6]">

            {/* Mobile Header - Hidden on Desktop */}
            <div className="bg-white sticky top-0 z-10 px-4 py-4 flex items-center gap-4 border-b md:hidden">
                <button onClick={() => navigate(-1)} className="material-icons">arrow_back</button>
                <h1 className="text-lg font-bold">My Wishlist ({wishlist.length})</h1>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:flex items-center justify-between px-6 py-4 bg-white shadow-sm mb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-500 hover:text-primary-600">
                        <span className="material-icons">arrow_back</span>
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">My Wishlist ({wishlist.length})</h1>
                </div>
            </div>

            {/* Main Content Area - Full Width Grid */}
            <div className="px-2 md:px-4">
                {wishlist.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 px-10 text-center md:bg-white md:shadow-sm md:rounded-sm md:py-32 md:max-w-4xl md:mx-auto">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-8 ring-red-50/50">
                            <span className="material-icons text-red-500 text-6xl md:text-7xl">favorite_border</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2">Empty Wishlist!</h2>
                        <p className="text-gray-500 text-sm mb-6">You have no items in your wishlist. Start adding!</p>
                        <button onClick={() => navigate('/')} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-bold hover:shadow-lg transition-all">Shop Now</button>
                    </div>
                ) : (
                    // Grid Layout: Full Width, Responsive Columns
                    // Mobile: grid-cols-2, Desktop: grid-cols-4 or grid-cols-5 for bigger cards
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5 md:gap-4">
                        {wishlist.map((product) => (
                            <div key={product.id} className="flex flex-col h-full bg-white rounded-xl p-2 md:rounded-sm md:p-3 hover:shadow-lg hover:scale-[1.01] transition-all duration-300 relative group border border-transparent md:border-gray-200">

                                {/* Delete Button - Corner */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleWishlist(product);
                                    }}
                                    className="absolute top-2 right-2 z-20 w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm border border-gray-100 transition-colors md:opacity-0 md:group-hover:opacity-100"
                                >
                                    <span className="material-icons text-[16px] md:text-[20px]">delete</span>
                                </button>

                                {/* Image Area */}
                                <div
                                    className="relative aspect-square mb-2 md:mb-3 bg-white flex items-center justify-center cursor-pointer overflow-hidden"
                                    onClick={() => navigate(`/product/${product.id}`)}
                                >
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-contain p-2"
                                    />
                                    {/* Rating Badge */}
                                    {product.rating && (
                                        <div className="absolute bottom-2 left-2 bg-white px-1.5 py-0.5 rounded-sm flex items-center gap-0.5 text-[10px] md:text-xs font-bold shadow-sm border border-black/5">
                                            {product.rating} <span className="material-icons text-green-700" style={{ fontSize: '10px' }}>star</span>
                                        </div>
                                    )}
                                </div>

                                {/* Details Area */}
                                <div className="flex-1 flex flex-col px-1" onClick={() => navigate(`/product/${product.id}`)}>
                                    <h3 className="text-xs md:text-sm font-medium text-gray-800 line-clamp-2 mb-1 hover:text-primary-600 cursor-pointer" title={product.name}>
                                        {product.name}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-2 mb-3">
                                        <span className="text-sm md:text-lg font-bold text-gray-900">₹{product.price.toLocaleString()}</span>
                                        {product.originalPrice && (
                                            <span className="text-[10px] md:text-sm text-gray-500 line-through">₹{product.originalPrice.toLocaleString()}</span>
                                        )}
                                        {product.discount && (
                                            <span className="text-[10px] md:text-xs font-bold text-green-600">
                                                {String(product.discount).toLowerCase().includes('off') ? product.discount : `${product.discount}% off`}
                                            </span>
                                        )}
                                    </div>

                                    {/* Move to Cart Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            moveToCart(product);
                                            navigate('/cart');
                                        }}
                                        className="mt-auto w-full bg-white text-primary-600 border border-primary-600 py-1.5 md:py-2.5 rounded-sm font-bold text-[10px] md:text-sm uppercase hover:bg-primary-600 hover:text-white transition-all"
                                    >
                                        Move to Cart
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Wishlist;
