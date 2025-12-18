import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ShopContextProvider } from './context/ShopContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Landing from './pages/Landing';
import ComingSoon from './pages/ComingSoon';
// import StoreBrowsing from './pages/StoreBrowsing'; // V2 Feature - Marketplace browsing
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import BecomeSeller from './pages/BecomeSeller';
import SellerDashboard from './pages/SellerDashboard';
import SellerAnalytics from './pages/SellerAnalytics';
import Shop from './pages/Shop';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import SearchResults from './pages/SearchResults';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import PaymentCallback from './pages/PaymentCallback';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import SellerOrders from './pages/SellerOrders';
import SellerOrderManagement from './pages/SellerOrderManagement';
import Favorites from './pages/Favorites';
import AdminDashboard from './pages/AdminDashboard';
import AdminSellers from './pages/AdminSellers';
import AdminOrders from './pages/AdminOrders';
import AdminAnalytics from './pages/AdminAnalytics';

// Smart fallback component that redirects based on auth status
function SmartFallback() {
  const { user } = useAuth();
  const location = useLocation();

  // If user is logged in, redirect based on role
  if (user) {
    if (user.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user.role === 'seller') {
      return <Navigate to="/seller/dashboard" replace />;
    } else {
      return <Navigate to="/orders" replace />;
    }
  }

  // If not logged in, redirect to Coming Soon page
  return <Navigate to="/" replace />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ShopContextProvider>
          <CartProvider>
            <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Shop pages - public */}
          <Route path="/shop/:shopSlug" element={<Shop />} />
          <Route path="/shop/:shopSlug/product/:productSlug" element={<ProductDetail />} />
          {/* Cart - accessible to all users (guests and authenticated) */}
          <Route path="/cart" element={<Cart />} />
          {/* Checkout - requires auth */}
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />
          {/* Payment callback - requires auth */}
          <Route
            path="/payment/callback"
            element={
              <ProtectedRoute>
                <PaymentCallback />
              </ProtectedRoute>
            }
          />
          {/* Orders - requires auth */}
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:orderId"
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            }
          />
          {/* Favorites - requires auth */}
          <Route
            path="/favorites"
            element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            }
          />
          {/* V2 Features - Commented out for v1 (store-centric focus) */}
          {/* <Route path="/products" element={<Products />} /> */}
          {/* <Route path="/products/:id" element={<ProductDetail />} /> */}
          {/* <Route path="/search" element={<SearchResults />} /> */}
          {/* <Route path="/browse" element={<ProtectedRoute><StoreBrowsing /></ProtectedRoute>} /> */}

          {/* Coming soon placeholder for main page */}
          <Route path="/" element={<ComingSoon />} />

          {/* Seller landing page - hidden route */}
          <Route path="/buy-tree/become-a-seller" element={<Landing />} />

          <Route
            path="/become-seller"
            element={
              <ProtectedRoute>
                <BecomeSeller />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/dashboard"
            element={
              <ProtectedRoute>
                <SellerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/orders"
            element={
              <ProtectedRoute>
                <SellerOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/order-management"
            element={
              <ProtectedRoute>
                <SellerOrderManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seller/analytics"
            element={
              <ProtectedRoute>
                <SellerAnalytics />
              </ProtectedRoute>
            }
          />
          {/* Admin Routes - requires admin role */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sellers"
            element={
              <ProtectedRoute>
                <AdminSellers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute>
                <AdminOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute>
                <AdminAnalytics />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<SmartFallback />} />
            </Routes>
          </CartProvider>
        </ShopContextProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
