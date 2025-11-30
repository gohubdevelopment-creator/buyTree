const db = require('../config/database');
const { logger } = require('../utils/logger');

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    next();
  } catch (error) {
    logger.error('Admin auth error', error, { userId: req.user?.id });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify admin access',
    });
  }
};

// Log admin action
const logAdminAction = async (adminId, actionType, targetType, targetId, details = {}) => {
  try {
    await db.query(
      `INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminId, actionType, targetType, targetId, JSON.stringify(details)]
    );
  } catch (error) {
    logger.error('Failed to log admin action', error, { adminId, actionType, targetType, targetId });
  }
};

// Get platform dashboard metrics
const getDashboardMetrics = async (req, res) => {
  try {
    // Total sellers
    const sellersResult = await db.query(`
      SELECT
        COUNT(*) as total_sellers,
        COUNT(CASE WHEN verification_status = 'approved' THEN 1 END) as approved_sellers,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending_sellers,
        COUNT(CASE WHEN verification_status = 'suspended' THEN 1 END) as suspended_sellers
      FROM sellers
    `);

    // Total orders and revenue
    const ordersResult = await db.query(`
      SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as orders_today,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as orders_this_week,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as orders_this_month,
        SUM(total_amount) as total_revenue,
        SUM(platform_fee) as total_commission,
        SUM(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN platform_fee ELSE 0 END) as commission_this_month
      FROM orders
      WHERE payment_status = 'paid'
    `);

    // Total users
    const usersResult = await db.query(`
      SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_this_week,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_this_month
      FROM users
      WHERE role = 'buyer'
    `);

    // Pending disputes
    const disputesResult = await db.query(`
      SELECT COUNT(*) as pending_disputes
      FROM disputes
      WHERE status = 'open'
    `);

    // Recent activity
    const recentOrdersResult = await db.query(`
      SELECT
        o.id,
        o.order_number,
        o.total_amount,
        o.status,
        o.created_at,
        u.first_name || ' ' || u.last_name as buyer_name,
        s.shop_name
      FROM orders o
      JOIN users u ON o.buyer_id = u.id
      JOIN sellers s ON o.seller_id = s.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    return res.status(200).json({
      success: true,
      data: {
        sellers: sellersResult.rows[0],
        orders: ordersResult.rows[0],
        users: usersResult.rows[0],
        disputes: disputesResult.rows[0],
        recentOrders: recentOrdersResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching dashboard metrics', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard metrics',
    });
  }
};

// Get all sellers with pagination and filters
const getAllSellers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all', // all, pending, approved, suspended
      search = ''
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const queryParams = [];
    let paramCount = 0;

    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND s.verification_status = $${paramCount}`;
      queryParams.push(status);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (s.shop_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    // Get sellers with stats
    const sellersResult = await db.query(`
      SELECT
        s.*,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at as user_created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COALESCE(AVG(r.rating), 0) as average_rating
      FROM sellers s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN orders o ON s.id = o.seller_id AND o.payment_status = 'paid'
      LEFT JOIN reviews r ON s.id = (SELECT seller_id FROM products WHERE id = r.product_id LIMIT 1)
      WHERE ${whereClause}
      GROUP BY s.id, u.id
      ORDER BY s.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...queryParams, limit, offset]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM sellers s
      JOIN users u ON s.user_id = u.id
      WHERE ${whereClause}
    `, queryParams);

    const total = parseInt(countResult.rows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        sellers: sellersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching sellers', error, { filters: req.query });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sellers',
    });
  }
};

// Approve seller
const approveSeller = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { sellerId } = req.params;
    const { notes } = req.body;

    await db.query(`
      UPDATE sellers
      SET verification_status = 'approved',
          verified_at = NOW(),
          admin_notes = $1
      WHERE id = $2
    `, [notes || null, sellerId]);

    // Log action
    await logAdminAction(adminId, 'approve_seller', 'seller', sellerId, { notes });

    return res.status(200).json({
      success: true,
      message: 'Seller approved successfully',
    });
  } catch (error) {
    logger.error('Error approving seller', error, { sellerId: req.params.sellerId, adminId: req.user.id });
    return res.status(500).json({
      success: false,
      message: 'Failed to approve seller',
    });
  }
};

// Suspend seller
const suspendSeller = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { sellerId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Suspension reason is required',
      });
    }

    await db.query(`
      UPDATE sellers
      SET verification_status = 'suspended',
          admin_notes = $1
      WHERE id = $2
    `, [reason, sellerId]);

    // Log action
    await logAdminAction(adminId, 'suspend_seller', 'seller', sellerId, { reason });

    return res.status(200).json({
      success: true,
      message: 'Seller suspended successfully',
    });
  } catch (error) {
    logger.error('Error suspending seller', error, { sellerId: req.params.sellerId, adminId: req.user.id });
    return res.status(500).json({
      success: false,
      message: 'Failed to suspend seller',
    });
  }
};

// Get all orders (platform-wide)
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'all',
      search = ''
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    const queryParams = [];
    let paramCount = 0;

    if (status !== 'all') {
      paramCount++;
      whereClause += ` AND o.status = $${paramCount}`;
      queryParams.push(status);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (o.order_number ILIKE $${paramCount} OR buyer.email ILIKE $${paramCount})`;
      queryParams.push(`%${search}%`);
    }

    const ordersResult = await db.query(`
      SELECT
        o.*,
        buyer.first_name || ' ' || buyer.last_name as buyer_name,
        buyer.email as buyer_email,
        s.shop_name,
        s.shop_slug
      FROM orders o
      JOIN users buyer ON o.buyer_id = buyer.id
      JOIN sellers s ON o.seller_id = s.id
      WHERE ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...queryParams, limit, offset]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM orders o
      WHERE ${whereClause}
    `, queryParams);

    const total = parseInt(countResult.rows[0].total);

    return res.status(200).json({
      success: true,
      data: {
        orders: ordersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching orders', error, { filters: req.query });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
    });
  }
};

// Get revenue analytics
const getRevenueAnalytics = async (req, res) => {
  try {
    const { period = '30days' } = req.query;

    let interval = '30 days';
    if (period === '7days') interval = '7 days';
    if (period === '90days') interval = '90 days';
    if (period === '1year') interval = '1 year';

    // Daily revenue for the period
    const dailyRevenueResult = await db.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(total_amount) as revenue,
        SUM(platform_fee) as commission
      FROM orders
      WHERE payment_status = 'paid'
        AND created_at >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Top sellers
    const topSellersResult = await db.query(`
      SELECT
        s.id,
        s.shop_name,
        s.shop_slug,
        COUNT(o.id) as total_orders,
        SUM(o.total_amount) as total_revenue,
        SUM(o.platform_fee) as total_commission
      FROM sellers s
      JOIN orders o ON s.id = o.seller_id
      WHERE o.payment_status = 'paid'
        AND o.created_at >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY s.id
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    // Category performance
    const categoryResult = await db.query(`
      SELECT
        p.category,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.subtotal) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.payment_status = 'paid'
        AND o.created_at >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY p.category
      ORDER BY revenue DESC
    `);

    return res.status(200).json({
      success: true,
      data: {
        dailyRevenue: dailyRevenueResult.rows,
        topSellers: topSellersResult.rows,
        categoryPerformance: categoryResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching revenue analytics', error, { period: req.query.period });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics',
    });
  }
};

// Get top performing products across all sellers
const getTopProducts = async (req, res) => {
  try {
    const { period = '30days' } = req.query;

    let interval = '30 days';
    if (period === '7days') interval = '7 days';
    if (period === '90days') interval = '90 days';
    if (period === '1year') interval = '1 year';

    // Top products by revenue
    const topProductsResult = await db.query(`
      SELECT
        p.id,
        p.name,
        p.image_urls,
        s.shop_name,
        s.shop_slug,
        SUM(oi.quantity) as units_sold,
        SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN sellers s ON p.seller_id = s.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.payment_status = 'paid'
        AND o.created_at >= CURRENT_DATE - INTERVAL '${interval}'
      GROUP BY p.id, p.name, p.image_urls, s.shop_name, s.shop_slug
      ORDER BY total_revenue DESC
      LIMIT 10
    `);

    return res.status(200).json({
      success: true,
      data: {
        topProducts: topProductsResult.rows,
      },
    });
  } catch (error) {
    logger.error('Error fetching top products', error, { period: req.query.period });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch top products',
    });
  }
};

module.exports = {
  requireAdmin,
  getDashboardMetrics,
  getAllSellers,
  approveSeller,
  suspendSeller,
  getAllOrders,
  getRevenueAnalytics,
  getTopProducts,
};
