const express = require('express');
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  getUserOrders,
  getUserOrdersByShop,
  getOrderDetails,
  getSellerOrders,
  updateOrderStatus,
  getSellerDashboardSummary,
  getSellerOrdersByStatus,
  addSellerNote,
  getSellerNotes,
  getOrderStatusHistory,
  confirmDelivery,
} = require('../controllers/orderController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Buyer routes
router.post('/create', createOrder);
router.get('/verify/:reference', verifyPayment);
router.get('/user', getUserOrders);
router.get('/user/shop/:shopSlug', getUserOrdersByShop);
router.post('/:orderId/confirm-delivery', confirmDelivery);

// Order details and history (both buyer and seller can access)
router.get('/:orderId', getOrderDetails);
router.get('/:orderId/history', getOrderStatusHistory);

// Seller routes - Dashboard & Order Management
router.get('/seller/dashboard-summary', getSellerDashboardSummary); // Performance optimized summary
router.get('/seller/orders', getSellerOrders); // All orders (legacy)
router.get('/seller/orders/:status', getSellerOrdersByStatus); // Orders by status with pagination
router.put('/seller/:orderId/status', updateOrderStatus); // Update order status
router.post('/seller/:orderId/notes', addSellerNote); // Add internal note
router.get('/seller/:orderId/notes', getSellerNotes); // Get all notes for order

module.exports = router;
