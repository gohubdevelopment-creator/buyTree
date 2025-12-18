import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useShopContext } from '../context/ShopContext';
import { useEffect } from 'react';

export default function Cart() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { currentShop, setCurrentShop } = useShopContext();
  const { cartItems, loading, updateQuantity, removeFromCart, getCartTotal } = useCart();

  // Auto-set shop context from cart items if missing
  useEffect(() => {
    if (!currentShop && cartItems.length > 0) {
      const firstItem = cartItems[0];
      if (firstItem.shop_slug) {
        // Restore shop context from cart
        const shopData = {
          id: firstItem.seller_id,
          shop_slug: firstItem.shop_slug,
          shop_name: firstItem.shop_name,
        };
        setCurrentShop(shopData);
      }
    }
  }, [cartItems, currentShop, setCurrentShop]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(price);
  };

  const handleQuantityChange = async (productId, newQuantity) => {
    if (newQuantity < 1) return;
    await updateQuantity(productId, newQuantity);
  };

  const handleRemove = async (productId) => {
    if (confirm('Remove this item from cart?')) {
      await removeFromCart(productId);
    }
  };

  const handleCheckoutAll = () => {
    const total = getCartTotal();
    if (total < 4000) {
      alert('Minimum total order value is ₦4,000. Please add more items.');
      return;
    }
    navigate('/checkout');
  };

  const handleCheckoutStore = (sellerId) => {
    const sellerGroup = itemsBySeller[sellerId];
    const storeTotal = sellerGroup.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (storeTotal < 4000) {
      alert(`Minimum order value for ${sellerGroup.shopName} is ₦4,000. Please add more items from this store.`);
      return;
    }

    // Navigate to checkout with only items from this seller
    navigate('/checkout', { state: { sellerId } });
  };

  const getStoreTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Group cart items by seller
  const itemsBySeller = cartItems.reduce((acc, item) => {
    const sellerId = item.seller_id;
    if (!acc[sellerId]) {
      acc[sellerId] = {
        shopName: item.shop_name,
        shopSlug: item.shop_slug,
        items: [],
      };
    }
    acc[sellerId].items.push(item);
    return acc;
  }, {});

  const sellerGroups = Object.values(itemsBySeller);
  const total = getCartTotal();
  const platformFee = total * 0.05;
  const minOrderValue = 4000;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 sm:pb-8">
      {/* Header */}
      <nav className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Shopping Cart</h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {user && (
                <>
                  <span className="text-gray-700 hidden sm:inline text-sm">Hello, {user.firstName}!</span>
                  {user.role === 'seller' && (
                    <button
                      onClick={() => navigate('/seller/dashboard')}
                      className="px-3 py-2 text-green-600 hover:bg-green-50 rounded-lg text-sm"
                    >
                      Dashboard
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {cartItems.length === 0 ? (
          // Empty Cart
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h3 className="mt-4 text-xl font-semibold text-gray-900">Your cart is empty</h3>
            <p className="mt-2 text-gray-600">Add some products to get started!</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-6 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {sellerGroups.map((sellerGroup, idx) => {
                const storeTotal = getStoreTotal(sellerGroup.items);
                const storeMeetsMinimum = storeTotal >= minOrderValue;
                const sellerId = sellerGroup.items[0]?.seller_id;

                return (
                  <div key={idx} className="bg-white rounded-lg shadow overflow-hidden">
                    {/* Shop Header */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                      <button
                        onClick={() => navigate(`/shop/${sellerGroup.shopSlug}`)}
                        className="flex items-center gap-2 hover:text-green-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <span className="font-semibold text-gray-900">{sellerGroup.shopName}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{formatPrice(storeTotal)}</p>
                        <p className="text-xs text-gray-500">{sellerGroup.items.length} item{sellerGroup.items.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    {/* Shop Items */}
                    <div className="divide-y divide-gray-200">
                    {sellerGroup.items.map((item) => (
                      <div key={item.id} className="p-4 sm:p-6">
                        <div className="flex gap-4">
                          {/* Product Image */}
                          <button
                            onClick={() => navigate(`/shop/${item.shop_slug}/product/${item.slug}`)}
                            className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 bg-gray-100 rounded-lg overflow-hidden"
                          >
                            {item.image_urls && item.image_urls.length > 0 ? (
                              <img
                                src={item.image_urls[0]}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </button>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => navigate(`/shop/${item.shop_slug}/product/${item.slug}`)}
                              className="text-left block"
                            >
                              <h3 className="font-semibold text-gray-900 hover:text-green-600 line-clamp-2">
                                {item.name}
                              </h3>
                            </button>
                            <p className="text-lg font-bold text-green-600 mt-1">
                              {formatPrice(item.price)}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {item.quantity_available} available
                            </p>

                            {/* Quantity Controls */}
                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)}
                                  className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                                  disabled={item.quantity <= 1}
                                >
                                  −
                                </button>
                                <span className="w-8 text-center font-semibold">{item.quantity}</span>
                                <button
                                  onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)}
                                  className="w-8 h-8 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                                  disabled={item.quantity >= item.quantity_available}
                                >
                                  +
                                </button>
                              </div>

                              <button
                                onClick={() => handleRemove(item.product_id)}
                                className="text-sm text-red-600 hover:text-red-700 font-medium"
                              >
                                Remove
                              </button>
                            </div>

                            {/* Subtotal */}
                            <p className="text-sm text-gray-600 mt-2">
                              Subtotal: <span className="font-semibold text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Store Checkout Footer */}
                  <div className="bg-gray-50 px-4 py-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600">Store Total:</span>
                      <span className="text-lg font-bold text-gray-900">{formatPrice(storeTotal)}</span>
                    </div>

                    {!storeMeetsMinimum && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 mb-3">
                        <p className="text-xs text-orange-800">
                          Add {formatPrice(minOrderValue - storeTotal)} more from this store to checkout
                        </p>
                      </div>
                    )}

                    {!user ? (
                      <button
                        onClick={() => navigate('/login?redirect=/checkout')}
                        className="w-full py-3 rounded-lg font-semibold transition-colors bg-green-600 text-white hover:bg-green-700"
                      >
                        Login to Checkout
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCheckoutStore(sellerId)}
                        disabled={!storeMeetsMinimum}
                        className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                          storeMeetsMinimum
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {storeMeetsMinimum ? 'Checkout This Store' : `Minimum ₦4,000 Required`}
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>

            {/* Order Summary - Desktop */}
            <div className="hidden lg:block">
              <div className="bg-white rounded-lg shadow p-6 sticky top-20">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between text-gray-600">
                    <span>Items ({cartItems.length})</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  {total < minOrderValue && (
                    <div className="flex justify-between text-orange-600 text-sm">
                      <span>Minimum order</span>
                      <span>{formatPrice(minOrderValue)}</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    *5% platform fee included
                  </p>
                </div>

                {total < minOrderValue && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-orange-800">
                      Add {formatPrice(minOrderValue - total)} more to checkout
                    </p>
                  </div>
                )}

                {!user ? (
                  <button
                    onClick={() => navigate('/login?redirect=/checkout')}
                    className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
                  >
                    Login to Checkout
                  </button>
                ) : (
                  <button
                    onClick={handleCheckoutAll}
                    disabled={total < minOrderValue}
                    className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Checkout All Stores ({sellerGroups.length})
                  </button>
                )}

                <p className="text-xs text-center text-gray-500 mt-3">
                  Or checkout stores individually above
                </p>

                <button
                  onClick={() => navigate(-1)}
                  className="w-full mt-3 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Fixed Bottom Bar */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Total ({cartItems.length} items)</p>
              <p className="text-xl font-bold text-gray-900">{formatPrice(total)}</p>
            </div>
            {!user ? (
              <button
                onClick={() => navigate('/login?redirect=/checkout')}
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors text-sm"
              >
                Login to Checkout
              </button>
            ) : (
              <button
                onClick={handleCheckoutAll}
                disabled={total < minOrderValue}
                className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
              >
                Checkout All ({sellerGroups.length})
              </button>
            )}
          </div>
          {total < minOrderValue ? (
            <p className="text-xs text-orange-600 text-center">
              Minimum order: {formatPrice(minOrderValue)}. Add {formatPrice(minOrderValue - total)} more.
            </p>
          ) : (
            <p className="text-xs text-gray-500 text-center">
              Or checkout stores individually
            </p>
          )}
        </div>
      )}
    </div>
  );
}
