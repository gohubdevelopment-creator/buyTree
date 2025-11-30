const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  requireAdmin,
  getDashboardMetrics,
  getAllSellers,
  approveSeller,
  suspendSeller,
  getAllOrders,
  getRevenueAnalytics,
  getTopProducts,
} = require('../controllers/adminController');

// All admin routes require authentication AND admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Dashboard metrics
router.get('/dashboard', getDashboardMetrics);

// Seller management
router.get('/sellers', getAllSellers);
router.put('/sellers/:sellerId/approve', approveSeller);
router.put('/sellers/:sellerId/suspend', suspendSeller);

// Order monitoring
router.get('/orders', getAllOrders);

// Analytics
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/top-products', getTopProducts);

module.exports = router;
