import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { productService, sellerService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { productCache, shopCache } from '../utils/cache';
import ShopSEO from '../components/SEO/ShopSEO';

const CATEGORIES = [
  'All',
  'Fashion & Apparel',
  'Electronics & Gadgets',
  'Books & Stationery',
  'Food & Snacks',
  'Beauty & Personal Care',
  'Sports & Fitness',
  'Home & Living',
  'Art & Crafts',
];

export default function Shop() {
  const { shopSlug } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentShopItemCount } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');

  useEffect(() => {
    fetchShopData();
  }, [shopSlug, selectedCategory, searchQuery, minPrice, maxPrice]);

  const fetchShopData = async (forceRefresh = false) => {
    setError('');

    try {
      // Build filter object
      const filters = {};
      if (selectedCategory && selectedCategory !== 'All') {
        filters.category = selectedCategory;
      }
      if (searchQuery) {
        filters.search = searchQuery;
      }
      if (minPrice) {
        filters.minPrice = minPrice;
      }
      if (maxPrice) {
        filters.maxPrice = maxPrice;
      }

      // Create cache keys
      const shopCacheKey = `shop_${shopSlug}`;
      const productsCacheKey = `products_${shopSlug}_${JSON.stringify(filters)}`;

      // Try to load from cache first (if not forcing refresh)
      if (!forceRefresh) {
        const cachedShop = shopCache.get(shopCacheKey);
        const cachedProducts = productCache.get(productsCacheKey);

        if (cachedShop && cachedProducts) {
          // Load from cache instantly
          setShop(cachedShop);
          setProducts(cachedProducts);
          setLoading(false);

          // Update URL params
          const params = {};
          if (selectedCategory !== 'All') params.category = selectedCategory;
          if (searchQuery) params.search = searchQuery;
          if (minPrice) params.minPrice = minPrice;
          if (maxPrice) params.maxPrice = maxPrice;
          setSearchParams(params);

          // Fetch fresh data in background to keep cache warm
          fetchShopDataFromServer(shopCacheKey, productsCacheKey, filters, true);
          return;
        }
      }

      // No cache or force refresh - show loading
      setLoading(true);
      await fetchShopDataFromServer(shopCacheKey, productsCacheKey, filters, false);
    } catch (err) {
      console.error('Error fetching shop data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load shop');
      setLoading(false);
    }
  };

  const fetchShopDataFromServer = async (shopCacheKey, productsCacheKey, filters, isBackgroundRefresh) => {
    try {
      // Fetch shop info
      console.log('Fetching shop:', shopSlug);
      const shopResponse = await sellerService.getSellerBySlug(shopSlug);
      console.log('Shop response:', shopResponse);
      const shopData = shopResponse.data.seller;

      // Cache shop data (30 minutes TTL)
      shopCache.set(shopCacheKey, shopData, 30 * 60 * 1000);
      if (!isBackgroundRefresh) {
        setShop(shopData);
      }

      // Fetch shop products
      console.log('Fetching products for shop:', shopSlug, 'with filters:', filters);
      const productsResponse = await productService.getProductsByShopSlug(shopSlug, filters);
      console.log('Products response:', productsResponse);
      const productsData = productsResponse.data.products;

      // Cache products (10 minutes TTL)
      productCache.set(productsCacheKey, productsData, 10 * 60 * 1000);
      if (!isBackgroundRefresh) {
        setProducts(productsData);

        // Update URL params
        const params = {};
        if (selectedCategory !== 'All') params.category = selectedCategory;
        if (searchQuery) params.search = searchQuery;
        if (minPrice) params.minPrice = minPrice;
        if (maxPrice) params.maxPrice = maxPrice;
        setSearchParams(params);

        setLoading(false);
      }
    } catch (err) {
      if (!isBackgroundRefresh) {
        console.error('Error fetching shop data from server:', err);
        throw err;
      }
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchShopData();
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(price);
  };

  const copyShopLink = () => {
    const shopUrl = `${window.location.origin}/shop/${shopSlug}`;
    navigator.clipboard.writeText(shopUrl);
    alert('Shop link copied to clipboard!');
  };

  if (loading && !shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading shop...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Shop not found</div>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ShopSEO shop={shop} />
      <div className="min-h-screen bg-gray-50">
        {/* Header - Shop-centric navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Shop Logo/Name as PRIMARY branding */}
            <div className="flex items-center gap-4">
              {shop.shop_logo_url ? (
                <img
                  src={shop.shop_logo_url}
                  alt={shop.shop_name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                  {shop.shop_name[0]}
                </div>
              )}
              <h1 className="text-xl font-bold text-gray-900">{shop.shop_name}</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Cart Icon - Visible for all users (guests and authenticated) */}
              <button
                onClick={() => navigate('/cart')}
                className="relative p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="My Cart"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {currentShopItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                    {currentShopItemCount > 99 ? '99+' : currentShopItemCount}
                  </span>
                )}
              </button>

              {user ? (
                <>
                  <span className="text-gray-700 hidden sm:inline">Hello, {user.firstName}!</span>
                  {user.role === 'seller' && (
                    <button
                      onClick={() => navigate('/seller/dashboard')}
                      className="px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg hidden sm:block"
                      title="My Dashboard"
                    >
                      Dashboard
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/orders')}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg hidden sm:block"
                    title="My Orders"
                  >
                    Orders
                  </button>
                  <button
                    onClick={logout}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate(`/login?shopSlug=${shopSlug}`)}
                    className="px-3 py-2 sm:px-4 text-gray-700 hover:bg-gray-100 rounded-lg text-sm sm:text-base"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate(`/signup?shopSlug=${shopSlug}`)}
                    className="px-3 py-2 sm:px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm sm:text-base"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Powered by BuyTree badge */}
        <div className="border-t border-gray-200 py-2 text-center">
          <span className="text-xs text-gray-500">
            Powered by <span className="font-semibold text-green-600">BuyTree</span>
          </span>
        </div>
      </nav>

      {/* Shop Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Shop Logo */}
            <div className="flex-shrink-0">
              {shop.shop_logo_url ? (
                <img
                  src={shop.shop_logo_url}
                  alt={`${shop.shop_name} logo`}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-2 border-green-500"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-3xl font-bold border-2 border-green-500">
                  {shop.shop_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Shop Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{shop.shop_name}</h1>
              {shop.shop_description && (
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{shop.shop_description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {shop.rating && parseFloat(shop.rating) > 0 ? parseFloat(shop.rating).toFixed(1) : 'New'}
                </span>
                <span className="flex items-center">
                  <svg className="w-5 h-5 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  {shop.total_orders || 0} orders
                </span>
                {shop.categories && shop.categories.length > 0 && (
                  <span className="flex items-center">
                    <svg className="w-5 h-5 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {shop.categories.join(', ')}
                  </span>
                )}
              </div>
            </div>

            {/* Share Button - Desktop */}
            <button
              onClick={copyShopLink}
              className="hidden sm:flex px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 items-center gap-2 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>

          {/* Share Button - Mobile (Full Width) */}
          <button
            onClick={copyShopLink}
            className="sm:hidden mt-4 w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share This Shop
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Search Bar - Always Visible */}
        <div className="mb-4">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm"
            />
            <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </form>
        </div>

        {/* Filter Button & Active Filters - Mobile */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-full shadow-sm hover:bg-gray-50"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="font-medium text-gray-700">Filters</span>
            {(selectedCategory !== 'All' || minPrice || maxPrice) && (
              <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {[selectedCategory !== 'All', minPrice, maxPrice].filter(Boolean).length}
              </span>
            )}
          </button>

          {/* Clear Filters */}
          {(selectedCategory !== 'All' || searchQuery || minPrice || maxPrice) && (
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSearchQuery('');
                setMinPrice('');
                setMaxPrice('');
              }}
              className="text-sm text-green-600 font-medium hover:text-green-700"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Products Grid */}
        <div className="flex-1">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchQuery || selectedCategory !== 'All' || minPrice || maxPrice
                    ? 'Try adjusting your filters'
                    : 'This shop has no products yet'}
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  {products.length} product{products.length !== 1 ? 's' : ''}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => navigate(`/shop/${shopSlug}/product/${product.slug || product.id}`)}
                      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer overflow-hidden"
                    >
                      {/* Product Image */}
                      <div className="aspect-square bg-gray-200">
                        {product.image_urls && product.image_urls.length > 0 ? (
                          <img
                            src={product.image_urls[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg
                              className="w-16 h-16 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-3 sm:p-4">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1 line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 mb-2 hidden sm:block">{product.category}</p>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <span className="text-base sm:text-xl font-bold text-green-600">
                            {formatPrice(product.price)}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-500">
                            {product.quantity_available > 0
                              ? `${product.quantity_available} left`
                              : 'Out of stock'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
        </div>
      </div>

      {/* Filter Modal - Mobile Bottom Sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowFilters(false)}
          />

          {/* Modal */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Category
                </label>
                <div className="space-y-2">
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        if (category === 'All') {
                          setShowFilters(false);
                        }
                      }}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedCategory === category
                          ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Price Range
                </label>
                <div className="space-y-3">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Min price (₦)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max price (₦)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Apply Button */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
              <button
                onClick={() => setShowFilters(false)}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
