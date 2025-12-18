import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productService, sellerService, reviewService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import ReviewList from '../components/reviews/ReviewList';
import ReviewForm from '../components/reviews/ReviewForm';
import ShopSEO from '../components/SEO/ShopSEO';

export default function ProductDetail() {
  const { shopSlug, productSlug } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addToCart: addToCartContext, itemCount } = useCart();

  const [product, setProduct] = useState(null);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userPurchasedOrder, setUserPurchasedOrder] = useState(null);

  useEffect(() => {
    fetchProductData();
  }, [productSlug, shopSlug]);

  useEffect(() => {
    // Check if user has purchased this product
    if (user && product) {
      checkUserPurchase();
    }
  }, [user, product]);

  const fetchProductData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch shop info
      const shopResponse = await sellerService.getSellerBySlug(shopSlug);
      setShop(shopResponse.data.seller);

      // Fetch all products from shop to find the one with matching slug
      const productsResponse = await productService.getProductsByShopSlug(shopSlug);
      const foundProduct = productsResponse.data.products.find(
        p => p.slug === productSlug || p.id.toString() === productSlug
      );

      if (!foundProduct) {
        setError('Product not found');
      } else {
        setProduct(foundProduct);
      }
    } catch (err) {
      console.error('Error fetching product:', err);
      setError(err.response?.data?.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const checkUserPurchase = async () => {
    try {
      const response = await reviewService.getReviewableProducts();
      const reviewableProducts = response.data.products || [];

      // Find if this product is in the reviewable list
      const purchasedProduct = reviewableProducts.find(
        p => p.product_id === product.id
      );

      if (purchasedProduct) {
        setUserPurchasedOrder({
          orderId: purchasedProduct.order_id,
          orderNumber: purchasedProduct.order_number,
        });
      } else {
        setUserPurchasedOrder(null);
      }
    } catch (error) {
      console.error('Failed to check user purchase:', error);
      setUserPurchasedOrder(null);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(price);
  };

  const handleAddToCart = async () => {
    // Prepare product data for guest cart
    const productData = {
      product_name: product.name,
      price: product.price,
      product_image_url: product.image_url,
      product_slug: product.slug,
      shop_slug: shopSlug,
    };

    const result = await addToCartContext(product.id, quantity, productData);
    if (result.success) {
      alert(`Added ${quantity} × ${product.name} to cart!`);
    } else {
      alert(result.error || 'Failed to add to cart');
    }
  };

  const handleBuyNow = async () => {
    // Prepare product data for cart
    const productData = {
      product_name: product.name,
      price: product.price,
      product_image_url: product.image_url,
      product_slug: product.slug,
      shop_slug: shopSlug,
    };

    // Add to cart first (works for both guest and authenticated users)
    const result = await addToCartContext(product.id, quantity, productData);

    if (!result.success) {
      alert(result.error || 'Failed to add to cart');
      return;
    }

    // If user is not authenticated, redirect to login with the current page as redirect
    if (!user) {
      const currentPath = `/shop/${shopSlug}/product/${productSlug}`;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    // If authenticated, go to checkout
    navigate('/checkout');
  };

  const handleShare = (platform) => {
    const productUrl = `${window.location.origin}/shop/${shopSlug}/product/${productSlug}`;
    const shareText = `Check out ${product.name} at ${shop.shop_name} on BuyTree! ${formatPrice(product.price)}`;

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + productUrl)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(productUrl)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`, '_blank');
        break;
      case 'copy':
        navigator.clipboard.writeText(productUrl);
        alert('Product link copied to clipboard!');
        setShowShareModal(false);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !product || !shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Product not found</div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(shopSlug ? `/shop/${shopSlug}` : '/')}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            {shopSlug ? 'Back to Shop' : 'Go Home'}
          </button>
        </div>
      </div>
    );
  }

  const images = product.image_urls && product.image_urls.length > 0 ? product.image_urls : [];

  return (
    <>
      <ShopSEO shop={shop} product={product} />
      <div className="min-h-screen bg-black bg-opacity-50 pb-20 sm:pb-0" onClick={() => navigate(`/shop/${shopSlug}`)}>
        {/* Header */}
      <nav className="bg-white shadow sticky top-0 z-40" onClick={(e) => e.stopPropagation()}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/shop/${shopSlug}`)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-xl sm:text-2xl font-bold text-green-600">
                BuyTree
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Cart Icon - Visible for all users (guests and authenticated) */}
              <button
                onClick={() => navigate('/cart')}
                className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </button>

              {user ? (
                <>
                  <span className="text-gray-700 hidden sm:inline text-sm">Hello, {user.firstName}!</span>
                  {user.role === 'seller' && (
                    <button
                      onClick={() => navigate('/seller/dashboard')}
                      className="px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg text-sm hidden sm:block"
                    >
                      Dashboard
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Image Gallery */}
            <div className="p-4 sm:p-6">
              {/* Main Image */}
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                {images.length > 0 ? (
                  <img
                    src={images[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-24 h-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Thumbnail Gallery */}
              {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage === index ? 'border-green-500' : 'border-gray-200'
                      }`}
                    >
                      <img src={image} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="p-4 sm:p-6 lg:p-8">
              {/* Shop Info */}
              <button
                onClick={() => navigate(`/shop/${shopSlug}`)}
                className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors w-full"
              >
                {shop.shop_logo_url ? (
                  <img src={shop.shop_logo_url} alt={shop.shop_name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold">
                    {shop.shop_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left flex-1">
                  <div className="font-semibold text-gray-900">{shop.shop_name}</div>
                  <div className="text-sm text-gray-600">Visit shop →</div>
                </div>
              </button>

              {/* Product Name */}
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>

              {/* Category & Stock Badge */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                  {product.category}
                </span>
                {product.quantity_available > 0 && product.quantity_available <= 10 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                    Only {product.quantity_available} left!
                  </span>
                )}
              </div>

              {/* Price */}
              <div className="mb-6">
                <div className="text-3xl sm:text-4xl font-bold text-green-600">{formatPrice(product.price)}</div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700 whitespace-pre-line">{product.description}</p>
                </div>
              )}

              {/* Quantity Selector */}
              {product.quantity_available > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-900 mb-2">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 font-semibold text-lg"
                      disabled={quantity <= 1}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={product.quantity_available}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(product.quantity_available, parseInt(e.target.value) || 1)))}
                      className="w-20 h-10 text-center border border-gray-300 rounded-lg font-semibold"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(product.quantity_available, quantity + 1))}
                      className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50 font-semibold text-lg"
                      disabled={quantity >= product.quantity_available}
                    >
                      +
                    </button>
                    <span className="text-sm text-gray-600">{product.quantity_available} available</span>
                  </div>
                </div>
              )}

              {/* Desktop Action Buttons */}
              <div className="hidden sm:block space-y-3">
                {product.quantity_available > 0 ? (
                  <>
                    <button
                      onClick={handleBuyNow}
                      className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Buy Now
                    </button>
                    <button
                      onClick={handleAddToCart}
                      className="w-full px-6 py-4 bg-white border-2 border-green-600 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                      Add to Cart
                    </button>
                    <button
                      onClick={() => setShowShareModal(true)}
                      className="w-full px-6 py-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      Share Product
                    </button>
                  </>
                ) : (
                  <div className="w-full px-6 py-4 bg-gray-100 text-gray-500 rounded-xl font-semibold text-center">
                    Out of Stock
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-8 space-y-6">
          {/* Write Review Button - Only show if user has purchased this product */}
          {user && userPurchasedOrder && !showReviewForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <button
                onClick={() => setShowReviewForm(true)}
                className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Write a Review
              </button>
              <p className="mt-2 text-sm text-gray-600">
                You purchased this product in order #{userPurchasedOrder.orderNumber}
              </p>
            </div>
          )}

          {/* Review Form */}
          {showReviewForm && userPurchasedOrder && (
            <ReviewForm
              productId={product.id}
              orderId={userPurchasedOrder.orderId}
              productName={product.name}
              onReviewSubmitted={() => {
                setShowReviewForm(false);
                setUserPurchasedOrder(null); // Clear so button doesn't show again
                // The ReviewList will automatically refresh
              }}
              onCancel={() => setShowReviewForm(false)}
            />
          )}

          {/* Reviews List */}
          <ReviewList productId={product.id} />
        </div>
      </div>

      {/* Mobile Fixed Bottom Bar */}
      {product.quantity_available > 0 && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 shadow-lg z-30">
          <div className="flex gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="px-3 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button
              onClick={handleAddToCart}
              className="flex-1 px-4 py-3 bg-white border-2 border-green-600 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Cart
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Buy
            </button>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowShareModal(false)}
          />

          {/* Modal */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Share Product</h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              {/* WhatsApp */}
              <button
                onClick={() => handleShare('whatsapp')}
                className="w-full flex items-center gap-4 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">WhatsApp</div>
                  <div className="text-sm text-gray-600">Share on WhatsApp</div>
                </div>
              </button>

              {/* Twitter */}
              <button
                onClick={() => handleShare('twitter')}
                className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Twitter</div>
                  <div className="text-sm text-gray-600">Share on Twitter</div>
                </div>
              </button>

              {/* Facebook */}
              <button
                onClick={() => handleShare('facebook')}
                className="w-full flex items-center gap-4 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Facebook</div>
                  <div className="text-sm text-gray-600">Share on Facebook</div>
                </div>
              </button>

              {/* Copy Link */}
              <button
                onClick={() => handleShare('copy')}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">Copy Link</div>
                  <div className="text-sm text-gray-600">Copy product link</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
