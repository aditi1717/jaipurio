import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdLocalOffer } from 'react-icons/md';
import API from '../../../services/api';
import ProductCard from '../components/product/ProductCard';

const OfferPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [offer, setOffer] = useState(null);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchOfferAndProducts();
    }, [id]);

    const fetchOfferAndProducts = async () => {
        setLoading(true);
        try {
            // Fetch offer details
            const { data: offerData } = await API.get(`/offers/${id}`);
            setOffer(offerData);

            // Fetch products based on offer type
            let productsData = [];
            
            if (offerData.applicableTo === 'product' && offerData.linkedProducts?.length > 0) {
                // Fetch specific products
                const productRequests = offerData.linkedProducts.map(productId =>
                    API.get(`/products/${productId}`).catch(() => null)
                );
                const responses = await Promise.all(productRequests);
                productsData = responses.filter(res => res !== null).map(res => res.data);
            } 
            else if (offerData.applicableTo === 'category' && offerData.linkedCategories?.length > 0) {
                // Fetch products from categories
                // Use numeric ID and Name for robustness (legacy data support)
                const categoryIds = offerData.linkedCategories.map(cat => cat.id).filter(id => id !== undefined);
                const categoryNames = offerData.linkedCategories.map(cat => cat.name);
                
                const { data } = await API.get('/products');
                
                productsData = data.filter(product => 
                    categoryIds.includes(product.categoryId) || 
                    categoryNames.includes(product.category)
                );
            } 
            else if (offerData.applicableTo === 'subcategory' && offerData.linkedSubCategories?.length > 0) {
                // Fetch products from subcategories
                const subCategoryIds = offerData.linkedSubCategories.map(subCat => subCat._id);
                const { data } = await API.get('/products');
                productsData = data.filter(product =>
                    product.subCategories && product.subCategories.some(subCat =>
                        subCategoryIds.includes(subCat)
                    )
                );
            }

            setProducts(productsData);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch offer:', err);
            setError('Failed to load offer details');
        } finally {
            setLoading(false);
        }
    };

    const getDiscountedPrice = (price) => {
        if (!offer) return price;
        
        if (offer.discountType === 'percentage') {
            return price - (price * offer.discountValue / 100);
        } else {
            return Math.max(0, price - offer.discountValue);
        }
    };

    const getDiscountBadge = () => {
        if (!offer) return '';
        
        if (offer.discountType === 'percentage') {
            return `${offer.discountValue}% OFF`;
        }
        return `₹${offer.discountValue} OFF`;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !offer) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Offer Not Found</h2>
                    <p className="text-gray-600 mb-6">{error || 'This offer may have expired or been removed.'}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-all"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    // Check if offer is active and within date range
    const now = new Date();
    const isActive = offer.isActive && 
                    new Date(offer.startDate) <= now && 
                    new Date(offer.endDate) >= now;

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
                    >
                        <MdArrowBack size={20} />
                        Back
                    </button>
                    
                    <div className="flex items-start gap-4">
                        <div className="bg-white/20 p-4 rounded-2xl">
                            <MdLocalOffer size={40} />
                        </div>
                        <div className="flex-1">
                            <h1 className="text-3xl font-black mb-2">{offer.title}</h1>
                            {offer.description && (
                                <p className="text-white/90 text-lg">{offer.description}</p>
                            )}
                            <div className="flex items-center gap-4 mt-4">
                                <div className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-full font-black text-lg">
                                    {getDiscountBadge()}
                                </div>
                                {!isActive && (
                                    <span className="bg-red-500 px-4 py-2 rounded-full font-bold text-sm">
                                        Expired
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-4 mt-3 text-sm text-white/70">
                                <span>Valid from {new Date(offer.startDate).toLocaleDateString('en-IN')}</span>
                                <span>•</span>
                                <span>to {new Date(offer.endDate).toLocaleDateString('en-IN')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Banner Image */}
            {offer.bannerImage && (
                <div className="max-w-7xl mx-auto px-4 -mt-8">
                    <img
                        src={offer.bannerImage}
                        alt={offer.title}
                        className="w-full h-64 object-cover rounded-2xl shadow-lg"
                    />
                </div>
            )}

            {/* Products Section */}
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="mb-6">
                    <h2 className="text-2xl font-black text-gray-900">
                        Products on Offer ({products.length})
                    </h2>
                    <p className="text-gray-600">
                        {offer.applicableTo === 'product' && 'Selected products'}
                        {offer.applicableTo === 'category' && `Products from ${offer.linkedCategories?.map(c => c.name).join(', ')}`}
                        {offer.applicableTo === 'subcategory' && `Products from ${offer.linkedSubCategories?.map(s => s.name).join(', ')}`}
                    </p>
                </div>

                {products.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
                        <p className="text-gray-500 font-bold">No products available for this offer</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {products.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                showDiscount={isActive}
                                offerDiscount={isActive ? offer.discountValue : null}
                                offerType={isActive ? offer.discountType : null}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Terms and Conditions */}
            {offer.termsAndConditions && (
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="bg-white rounded-2xl p-6 border border-gray-200">
                        <h3 className="text-lg font-black text-gray-900 mb-3">Terms & Conditions</h3>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{offer.termsAndConditions}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfferPage;
