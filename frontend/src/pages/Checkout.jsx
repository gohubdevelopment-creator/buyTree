import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { orderService } from '../services/api';

export default function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cartItems, getCartTotal, clearCart, syncPendingUpdates } = useCart();
  const [loading, setLoading] = useState(false);

  // Load saved delivery details from localStorage
  const loadSavedDeliveryDetails = () => {
    try {
      const saved = localStorage.getItem('buytree_delivery_details');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load delivery details:', error);
    }
    return {
      name: '',
      phone: '',
      address: '',
      notes: '',
    };
  };

  const [deliveryDetails, setDeliveryDetails] = useState(loadSavedDeliveryDetails());

  // Get sellerId from location state (for individual checkout)
  const selectedSellerId = location.state?.sellerId;

  // Filter cart items if checking out a specific seller
  const checkoutItems = selectedSellerId
    ? cartItems.filter(item => item.seller_id === selectedSellerId)
    : cartItems;

  useEffect(() => {
    // Sync any pending cart updates when entering checkout
    const syncCart = async () => {
      await syncPendingUpdates();
    };
    syncCart();
  }, [syncPendingUpdates]);

  useEffect(() => {
    // Redirect if cart is empty
    if (cartItems.length === 0 || checkoutItems.length === 0) {
      navigate('/cart');
      return;
    }

    // Check minimum order value for the items being checked out
    const total = checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (total < 4000) {
      alert('Minimum order value is ₦4,000');
      navigate('/cart');
    }
  }, [cartItems, checkoutItems, navigate]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(price);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const updated = {
      ...deliveryDetails,
      [name]: value,
    };
    setDeliveryDetails(updated);

    // Save to localStorage (excluding notes for privacy)
    try {
      const toSave = {
        name: updated.name,
        phone: updated.phone,
        address: updated.address,
        notes: '', // Don't persist notes
      };
      localStorage.setItem('buytree_delivery_details', JSON.stringify(toSave));
    } catch (error) {
      console.error('Failed to save delivery details:', error);
    }
  };

  const validateForm = () => {
    if (!deliveryDetails.name.trim()) {
      alert('Please enter your full name');
      return false;
    }
    if (!deliveryDetails.phone.trim()) {
      alert('Please enter your phone number');
      return false;
    }
    if (deliveryDetails.phone.length < 11) {
      alert('Please enter a valid phone number');
      return false;
    }
    if (!deliveryDetails.address.trim()) {
      alert('Please enter your delivery address');
      return false;
    }
    return true;
  };

  const handleCheckout = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Group checkout items by seller (only the items being checked out)
      const itemsBySeller = checkoutItems.reduce((acc, item) => {
        const sellerId = item.seller_id;
        if (!acc[sellerId]) {
          acc[sellerId] = [];
        }
        acc[sellerId].push({
          productId: item.product_id,
          quantity: item.quantity,
          price: item.price,
        });
        return acc;
      }, {});

      // Create orders for each seller
      const orders = Object.entries(itemsBySeller).map(([sellerId, items]) => ({
        sellerId: parseInt(sellerId),
        items,
      }));

      // Initialize Paystack payment
      const response = await orderService.createOrder({ orders, deliveryDetails });

      if (response.success) {
        // Redirect to Paystack checkout
        window.location.href = response.data.authorization_url;
      } else {
        alert(response.message || 'Failed to create order');
        setLoading(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert(error.response?.data?.message || 'Failed to process checkout');
      setLoading(false);
    }
  };

  // Group checkout items by seller for display (only items being checked out)
  const itemsBySeller = checkoutItems.reduce((acc, item) => {
    const sellerId = item.seller_id;
    if (!acc[sellerId]) {
      acc[sellerId] = {
        shopName: item.shop_name,
        items: [],
      };
    }
    acc[sellerId].items.push(item);
    return acc;
  }, {});

  const sellerGroups = Object.values(itemsBySeller);
  const total = checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const platformFee = total * 0.05;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <nav className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/cart')}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Checkout</h1>
                {selectedSellerId && (
                  <p className="text-xs text-gray-600">Checking out from {sellerGroups[0]?.shopName}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Delivery Details Form */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Delivery Details</h2>

              <form className="space-y-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={deliveryDetails.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={deliveryDetails.phone}
                    onChange={handleInputChange}
                    placeholder="08012345678"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Delivery Address */}
                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={deliveryDetails.address}
                    onChange={handleInputChange}
                    placeholder="Enter your full delivery address including landmarks"
                    rows="4"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    required
                  />
                </div>

                {/* Order Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Order Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={deliveryDetails.notes}
                    onChange={handleInputChange}
                    placeholder="Any special instructions for delivery?"
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                  />
                </div>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="bg-white rounded-lg shadow p-6 sticky top-20">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>

              {/* Seller Groups */}
              <div className="space-y-4 mb-4">
                {sellerGroups.map((sellerGroup, idx) => (
                  <div key={idx} className="border-b border-gray-200 pb-3">
                    <p className="font-semibold text-gray-900 mb-2">{sellerGroup.shopName}</p>
                    {sellerGroup.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-gray-600 mb-1">
                        <span className="truncate mr-2">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Platform Fee (5%)</span>
                  <span>{formatPrice(platformFee)}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-green-900">Secure Payment</p>
                    <p className="text-xs text-green-700 mt-1">
                      Your payment is processed securely via Paystack
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </span>
                ) : (
                  'Pay with Paystack'
                )}
              </button>

              <p className="text-xs text-center text-gray-500 mt-3">
                By completing this purchase, you agree to our terms and conditions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
