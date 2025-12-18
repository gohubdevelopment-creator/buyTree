import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authService = {
  signup: async (userData) => {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  },

  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Seller endpoints
export const sellerService = {
  registerSeller: async (sellerData) => {
    const response = await api.post('/sellers/register', sellerData);
    return response.data;
  },

  getSellerProfile: async () => {
    const response = await api.get('/sellers/profile/me');
    return response.data;
  },

  getBanks: async () => {
    const response = await api.get('/sellers/banks');
    return response.data;
  },

  getSellerBySlug: async (shopSlug) => {
    const response = await api.get(`/sellers/${shopSlug}`);
    return response.data;
  },

  getAllShops: async (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await api.get(`/sellers/shops/all?${queryParams}`);
    return response.data;
  },
};

// Product endpoints
export const productService = {
  createProduct: async (productData) => {
    const response = await api.post('/products', productData);
    return response.data;
  },

  getProducts: async (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/products?${queryParams}`);
    return response.data;
  },

  getProductById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  getMyProducts: async () => {
    const response = await api.get('/products/my/products');
    return response.data;
  },

  getProductsByShopSlug: async (shopSlug, filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    const response = await api.get(`/products/shop/${shopSlug}?${queryParams}`);
    return response.data;
  },

  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },

  deleteProduct: async (id) => {
    const response = await api.delete(`/products/${id}`);
    return response.data;
  },

  searchProducts: async (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await api.get(`/products/search?${queryParams}`);
    return response.data;
  },
};

// Upload endpoints
export const uploadService = {
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.post('/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadMultipleImages: async (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    const response = await api.post('/upload/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// Cart endpoints
export const cartService = {
  getCart: async () => {
    const response = await api.get('/cart');
    return response.data;
  },

  addToCart: async (productId, quantity) => {
    const response = await api.post('/cart/add', { productId, quantity });
    return response.data;
  },

  updateCartItem: async (productId, quantity) => {
    const response = await api.put('/cart/update', { productId, quantity });
    return response.data;
  },

  removeFromCart: async (productId) => {
    const response = await api.delete(`/cart/remove/${productId}`);
    return response.data;
  },

  clearCart: async () => {
    const response = await api.delete('/cart/clear');
    return response.data;
  },
};

// Order endpoints
export const orderService = {
  // Buyer endpoints
  createOrder: async (orderData) => {
    const response = await api.post('/orders/create', orderData);
    return response.data;
  },

  verifyPayment: async (reference) => {
    const response = await api.get(`/orders/verify/${reference}`);
    return response.data;
  },

  getUserOrders: async () => {
    const response = await api.get('/orders/user');
    return response.data;
  },

  getUserOrdersByShop: async (shopSlug) => {
    const response = await api.get(`/orders/user/shop/${shopSlug}`);
    return response.data;
  },

  confirmDelivery: async (orderId, feedbackData = {}) => {
    const response = await api.post(`/orders/${orderId}/confirm-delivery`, feedbackData);
    return response.data;
  },

  // Shared endpoints (buyer and seller)
  getOrderDetails: async (orderId) => {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  },

  getOrderHistory: async (orderId) => {
    const response = await api.get(`/orders/${orderId}/history`);
    return response.data;
  },

  // Seller endpoints - Dashboard & Management
  getSellerDashboardSummary: async () => {
    const response = await api.get('/orders/seller/dashboard-summary');
    return response.data;
  },

  getSellerOrders: async () => {
    const response = await api.get('/orders/seller/orders');
    return response.data;
  },

  getSellerOrdersByStatus: async (status, params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await api.get(`/orders/seller/orders/${status}?${queryParams}`);
    return response.data;
  },

  updateOrderStatus: async (orderId, statusData) => {
    const response = await api.put(`/orders/seller/${orderId}/status`, statusData);
    return response.data;
  },

  addSellerNote: async (orderId, note) => {
    const response = await api.post(`/orders/seller/${orderId}/notes`, { note });
    return response.data;
  },

  getSellerNotes: async (orderId) => {
    const response = await api.get(`/orders/seller/${orderId}/notes`);
    return response.data;
  },
};

// Analytics endpoints
export const analyticsService = {
  getSellerAnalytics: async () => {
    const response = await api.get('/analytics/seller');
    return response.data;
  },

  getProductViewAnalytics: async (period = '30') => {
    const response = await api.get(`/analytics/seller/views?period=${period}`);
    return response.data;
  },
};

// Review endpoints
export const reviewService = {
  createReview: async (reviewData) => {
    const response = await api.post('/reviews', reviewData);
    return response.data;
  },

  getProductReviews: async (productId, params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await api.get(`/reviews/product/${productId}?${queryParams}`);
    return response.data;
  },

  getMyReviews: async () => {
    const response = await api.get('/reviews/my-reviews');
    return response.data;
  },

  getReviewableProducts: async () => {
    const response = await api.get('/reviews/reviewable-products');
    return response.data;
  },

  updateReview: async (reviewId, reviewData) => {
    const response = await api.put(`/reviews/${reviewId}`, reviewData);
    return response.data;
  },

  deleteReview: async (reviewId) => {
    const response = await api.delete(`/reviews/${reviewId}`);
    return response.data;
  },

  markReviewHelpful: async (reviewId) => {
    const response = await api.post(`/reviews/${reviewId}/helpful`);
    return response.data;
  },

  addSellerResponse: async (reviewId, response) => {
    const res = await api.post(`/reviews/${reviewId}/seller-response`, { response });
    return res.data;
  },
};

// Favorite endpoints
export const favoriteService = {
  getUserFavorites: async () => {
    const response = await api.get('/favorites');
    return response.data;
  },

  addFavorite: async (productId) => {
    const response = await api.post('/favorites/add', { productId });
    return response.data;
  },

  removeFavorite: async (productId) => {
    const response = await api.delete(`/favorites/remove/${productId}`);
    return response.data;
  },

  checkFavorite: async (productId) => {
    const response = await api.get(`/favorites/check/${productId}`);
    return response.data;
  },

  batchCheckFavorites: async (productIds) => {
    const response = await api.post('/favorites/batch-check', { productIds });
    return response.data;
  },
};

export default api;
