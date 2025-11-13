import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { productService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { searchCache } from '../utils/cache';

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

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'price_low', label: 'Price: Low to High' },
  { value: 'price_high', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
];

export default function SearchResults() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { addToCart } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingToCart, setAddingToCart] = useState({});

  // Get query from URL
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'relevance');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (query) {
      fetchSearchResults();
    }
  }, [query, selectedCategory, minPrice, maxPrice, sortBy]);

  const fetchSearchResults = async () => {
    setError('');

    try {
      const params = { q: query };

      if (selectedCategory && selectedCategory !== 'All') {
        params.category = selectedCategory;
      }
      if (minPrice) {
        params.minPrice = minPrice;
      }
      if (maxPrice) {
        params.maxPrice = maxPrice;
      }
      if (sortBy) {
        params.sort = sortBy;
      }

      // Create cache key from search params
      const cacheKey = `search_${JSON.stringify(params)}`;

      // Try to load from cache first
      const cachedResults = searchCache.get(cacheKey);
      if (cachedResults) {
        // Load from cache instantly
        setProducts(cachedResults);
        setLoading(false);

        // Fetch fresh data in background to keep cache warm
        fetchSearchResultsFromServer(params, cacheKey, true);
        return;
      }

      // No cache - show loading and fetch
      setLoading(true);
      await fetchSearchResultsFromServer(params, cacheKey, false);
    } catch (err) {
      setError('Failed to search products');
      console.error('Search error:', err);
      setLoading(false);
    }
  };

  const fetchSearchResultsFromServer = async (params, cacheKey, isBackgroundRefresh) => {
    try {
      const response = await productService.searchProducts(params);
      const results = response.data.products || [];

      // Cache search results (5 minutes TTL)
      searchCache.set(cacheKey, results, 5 * 60 * 1000);

      if (!isBackgroundRefresh) {
        setProducts(results);
        setLoading(false);
      }
    } catch (err) {
      if (!isBackgroundRefresh) {
        throw err;
      }
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const params = { q: searchInput.trim() };
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (sortBy) params.sort = sortBy;
      setSearchParams(params);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    const params = { q: query };
    if (category !== 'All') params.category = category;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (sortBy) params.sort = sortBy;
    setSearchParams(params);
  };

  const handleSortChange = (sort) => {
    setSortBy(sort);
    const params = { q: query, sort };
    if (selectedCategory !== 'All') params.category = selectedCategory;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    setSearchParams(params);
  };

  const applyPriceFilter = () => {
    const params = { q: query };
    if (selectedCategory !== 'All') params.category = selectedCategory;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (sortBy) params.sort = sortBy;
    setSearchParams(params);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setSelectedCategory('All');
    setMinPrice('');
    setMaxPrice('');
    setSortBy('relevance');
    setSearchParams({ q: query });
  };

  const handleAddToCart = async (productId) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setAddingToCart((prev) => ({ ...prev, [productId]: true }));
      await addToCart(productId, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
      alert('Failed to add to cart');
    } finally {
      setAddingToCart((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(price);
  };

  const activeFiltersCount =
    (selectedCategory !== 'All' ? 1 : 0) +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4 flex-1">
              <button onClick={() => navigate('/')} className="text-2xl font-bold text-green-600 whitespace-nowrap">
                BuyTree
              </button>

              {/* Search Bar */}
              <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
                <div className="relative">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search products..."
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>

            <div className="flex items-center space-x-4 ml-4">
              {user ? (
                <>
                  <button
                    onClick={() => navigate('/cart')}
                    className="p-2 text-gray-600 hover:text-green-600 relative"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </button>
                  {user.role === 'seller' && (
                    <button
                      onClick={() => navigate('/seller/dashboard')}
                      className="hidden md:block px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg font-medium"
                    >
                      Seller Dashboard
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => navigate('/signup')}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Info & Controls */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Search Results for "{query}"
              </h1>
              <p className="text-gray-600 mt-1">
                {loading ? 'Searching...' : `${products.length} products found`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {/* Filters Button (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {activeFiltersCount > 0 && (
                  <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Active Filters Tags */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedCategory !== 'All' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  {selectedCategory}
                  <button
                    onClick={() => handleCategoryChange('All')}
                    className="hover:text-green-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {minPrice && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Min: {formatPrice(minPrice)}
                  <button
                    onClick={() => {
                      setMinPrice('');
                      applyPriceFilter();
                    }}
                    className="hover:text-green-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {maxPrice && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  Max: {formatPrice(maxPrice)}
                  <button
                    onClick={() => {
                      setMaxPrice('');
                      applyPriceFilter();
                    }}
                    className="hover:text-green-900"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <aside className={`lg:w-64 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-lg shadow p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>

              {/* Categories */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Category</h3>
                <div className="space-y-2">
                  {CATEGORIES.map((category) => (
                    <label key={category} className="flex items-center">
                      <input
                        type="radio"
                        name="category"
                        checked={selectedCategory === category}
                        onChange={() => handleCategoryChange(category)}
                        className="text-green-600 focus:ring-green-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Price Range</h3>
                <div className="space-y-3">
                  <input
                    type="number"
                    placeholder="Min price"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="number"
                    placeholder="Max price"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={applyPriceFilter}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <main className="flex-1">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Searching products...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
                <button
                  onClick={fetchSearchResults}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Retry
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600 mb-4">Try adjusting your search or filters</p>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <div key={product.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
                    <div
                      onClick={() => navigate(`/products/${product.id}`)}
                      className="cursor-pointer"
                    >
                      {product.image_urls && product.image_urls.length > 0 ? (
                        <img
                          src={product.image_urls[0]}
                          alt={product.name}
                          className="w-full h-48 object-cover rounded-t-lg"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded-t-lg flex items-center justify-center">
                          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{product.description}</p>

                        {/* Shop Name with Verification Badge */}
                        <div className="flex items-center gap-2 mb-2">
                          <Link
                            to={`/shop/${product.shop_slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                          >
                            {product.shop_name}
                          </Link>
                          {product.is_verified && (
                            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20" title="Verified Seller">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-lg font-bold text-green-600">{formatPrice(product.price)}</span>
                          <span className="text-sm text-gray-500">{product.quantity_available} in stock</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      {product.quantity_available > 0 ? (
                        <button
                          onClick={() => handleAddToCart(product.id)}
                          disabled={addingToCart[product.id]}
                          className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                          {addingToCart[product.id] ? 'Adding...' : 'Add to Cart'}
                        </button>
                      ) : (
                        <button disabled className="w-full bg-gray-300 text-gray-500 py-2 rounded-lg cursor-not-allowed">
                          Out of Stock
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
