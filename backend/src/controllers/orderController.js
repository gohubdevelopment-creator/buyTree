const db = require('../config/database');
const axios = require('axios');

// Initialize Paystack payment
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orders, deliveryDetails } = req.body;

    // Validate input
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order data',
      });
    }

    if (!deliveryDetails || !deliveryDetails.name || !deliveryDetails.phone || !deliveryDetails.address) {
      return res.status(400).json({
        success: false,
        message: 'Delivery details are required',
      });
    }

    // Get user email for Paystack
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const userEmail = userResult.rows[0].email;

    // Calculate total amount across all orders
    let totalAmount = 0;
    const orderDetails = [];

    for (const order of orders) {
      const { sellerId, items } = order;

      // Validate seller exists
      const sellerResult = await db.query(
        'SELECT id, shop_name, paystack_subaccount_code FROM sellers WHERE id = $1',
        [sellerId]
      );

      if (sellerResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Seller ${sellerId} not found`,
        });
      }

      const seller = sellerResult.rows[0];

      // Calculate order total and validate products
      let orderTotal = 0;
      const validatedItems = [];

      for (const item of items) {
        const { productId, quantity, price } = item;

        // Validate product and stock
        const productResult = await db.query(
          `SELECT id, name, price, quantity_available
           FROM products
           WHERE id = $1 AND seller_id = $2 AND deleted_at IS NULL`,
          [productId, sellerId]
        );

        if (productResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: `Product ${productId} not found`,
          });
        }

        const product = productResult.rows[0];

        if (product.quantity_available < quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${product.name}`,
          });
        }

        const subtotal = product.price * quantity;
        orderTotal += subtotal;

        validatedItems.push({
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          quantity,
          subtotal,
        });
      }

      // Check minimum order value
      if (orderTotal < 4000) {
        return res.status(400).json({
          success: false,
          message: 'Minimum order value is ₦4,000',
        });
      }

      totalAmount += orderTotal;

      orderDetails.push({
        sellerId,
        shopName: seller.shop_name,
        subaccountCode: seller.paystack_subaccount_code,
        orderTotal,
        items: validatedItems,
      });
    }

    // Calculate platform fee (5%)
    const platformFee = totalAmount * 0.05;

    // Generate unique reference
    const reference = `BT-${Date.now()}-${userId}`;

    // Store order metadata temporarily (we'll create actual orders after payment)
    const metadata = {
      userId,
      orders: orderDetails,
      deliveryDetails,
      totalAmount,
      platformFee,
    };

    // Initialize Paystack transaction
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: userEmail,
        amount: totalAmount * 100, // Convert to kobo
        reference,
        metadata,
        callback_url: `${process.env.FRONTEND_URL}/payment/callback`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!paystackResponse.data.status) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize payment',
      });
    }

    res.json({
      success: true,
      message: 'Payment initialized',
      data: {
        authorization_url: paystackResponse.data.data.authorization_url,
        access_code: paystackResponse.data.data.access_code,
        reference,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message,
    });
  }
};

// Verify payment and create orders
const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    // Check if orders already exist for this payment reference (idempotency check)
    const existingOrders = await db.query(
      `SELECT o.id, o.order_number
       FROM orders o
       WHERE o.paystack_reference = $1`,
      [reference]
    );

    if (existingOrders.rows.length > 0) {
      // Orders already created for this payment - return success with existing orders
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: {
          orders: existingOrders.rows.map(order => ({
            orderId: order.id,
            orderNumber: order.order_number,
          })),
          reference,
        },
      });
    }

    // Verify transaction with Paystack
    const paystackResponse = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (!paystackResponse.data.status || paystackResponse.data.data.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed',
      });
    }

    const paymentData = paystackResponse.data.data;
    const { metadata } = paymentData;
    const { userId, orders, deliveryDetails, totalAmount } = metadata;

    // Start transaction
    await db.query('BEGIN');

    try {
      const createdOrders = [];

      // Create orders for each seller
      for (const orderDetail of orders) {
        const { sellerId, orderTotal, items } = orderDetail;

        const platformFee = orderTotal * 0.05;
        const sellerAmount = orderTotal - platformFee;

        // Calculate estimated delivery date (7 days from now)
        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7);

        // Generate order number
        const orderNumber = `ORD-${Date.now()}-${sellerId}`;

        // Create order
        const orderResult = await db.query(
          `INSERT INTO orders (
            order_number, buyer_id, seller_id, total_amount, platform_fee, seller_amount,
            status, payment_status, paystack_reference,
            delivery_name, delivery_phone, delivery_address, notes,
            estimated_delivery_date
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id, order_number`,
          [
            orderNumber,
            userId,
            sellerId,
            orderTotal,
            platformFee,
            sellerAmount,
            'pending',
            'paid',
            reference,
            deliveryDetails.name,
            deliveryDetails.phone,
            deliveryDetails.address,
            deliveryDetails.notes || null,
            estimatedDeliveryDate,
          ]
        );

        const orderId = orderResult.rows[0].id;

        // Create order items
        for (const item of items) {
          await db.query(
            `INSERT INTO order_items (
              order_id, product_id, product_name, product_price, quantity, subtotal
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              orderId,
              item.productId,
              item.productName,
              item.productPrice,
              item.quantity,
              item.subtotal,
            ]
          );

          // Update product stock
          await db.query(
            'UPDATE products SET quantity_available = quantity_available - $1 WHERE id = $2',
            [item.quantity, item.productId]
          );
        }

        createdOrders.push({
          orderId,
          orderNumber: orderResult.rows[0].order_number,
        });
      }

      // Clear user's cart
      await db.query(
        'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)',
        [userId]
      );

      // Commit transaction
      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Payment verified and orders created',
        data: {
          orders: createdOrders,
          reference,
        },
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message,
    });
  }
};

// Get user's orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(
      `SELECT
        o.id, o.order_number, o.total_amount, o.status, o.payment_status,
        o.delivery_name, o.delivery_phone, o.delivery_address,
        o.estimated_delivery_date, o.created_at,
        s.shop_name, s.shop_slug
      FROM orders o
      JOIN sellers s ON o.seller_id = s.id
      WHERE o.buyer_id = $1
      ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
};

// Get user's orders filtered by shop
const getUserOrdersByShop = async (req, res) => {
  try {
    const userId = req.user.id;
    const { shopSlug } = req.params;

    // Validate shop exists
    const shopResult = await db.query(
      'SELECT id FROM sellers WHERE shop_slug = $1',
      [shopSlug]
    );

    if (shopResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Shop not found',
      });
    }

    const shopId = shopResult.rows[0].id;

    // Get orders for this shop only
    const result = await db.query(
      `SELECT
        o.id, o.order_number, o.total_amount, o.status, o.payment_status,
        o.delivery_name, o.delivery_phone, o.delivery_address,
        o.estimated_delivery_date, o.created_at,
        s.shop_name, s.shop_slug
      FROM orders o
      JOIN sellers s ON o.seller_id = s.id
      WHERE o.buyer_id = $1 AND o.seller_id = $2
      ORDER BY o.created_at DESC`,
      [userId, shopId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get user orders by shop error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
};

// Get single order details
const getOrderDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Get order
    const orderResult = await db.query(
      `SELECT
        o.*, s.shop_name, s.shop_slug
      FROM orders o
      JOIN sellers s ON o.seller_id = s.id
      WHERE o.id = $1 AND o.buyer_id = $2`,
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await db.query(
      `SELECT * FROM order_items WHERE order_id = $1`,
      [orderId]
    );

    order.items = itemsResult.rows;

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message,
    });
  }
};

// Get seller's orders
const getSellerOrders = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get seller ID
    const sellerResult = await db.query(
      'SELECT id FROM sellers WHERE user_id = $1',
      [userId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a seller',
      });
    }

    const sellerId = sellerResult.rows[0].id;

    const result = await db.query(
      `SELECT
        o.id, o.order_number, o.total_amount, o.seller_amount, o.status, o.payment_status,
        o.delivery_name, o.delivery_phone, o.delivery_address,
        o.estimated_delivery_date, o.created_at,
        u.first_name, u.last_name, u.email
      FROM orders o
      JOIN users u ON o.buyer_id = u.id
      WHERE o.seller_id = $1
      ORDER BY o.created_at DESC`,
      [sellerId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get seller orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
};

// Update order status (seller only) - ENHANCED with workflow validation
const updateOrderStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId} = req.params;
    const { status, notes } = req.body;

    // Define valid status transitions for workflow enforcement
    // Note: Cancellation removed until Paystack refund integration is complete
    const statusWorkflow = {
      'pending': ['processing'],
      'processing': ['ready_for_pickup'],
      'ready_for_pickup': ['in_transit'],
      'in_transit': ['delivered'],
      'delivered': [], // Terminal state
      'cancelled': [], // Terminal state (not reachable by sellers for now)
    };

    // Validate status
    const validStatuses = ['pending', 'processing', 'ready_for_pickup', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Valid statuses: ' + validStatuses.join(', '),
      });
    }

    // Get seller ID
    const sellerResult = await db.query(
      'SELECT id FROM sellers WHERE user_id = $1',
      [userId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a seller',
      });
    }

    const sellerId = sellerResult.rows[0].id;

    // Get current order status
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND seller_id = $2',
      [orderId, sellerId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderResult.rows[0];

    // Validate status transition
    const allowedTransitions = statusWorkflow[order.status] || [];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from "${order.status}" to "${status}". Allowed transitions: ${allowedTransitions.join(', ') || 'none (terminal state)'}`,
      });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update order status with appropriate timestamps
      const updateQuery = `
        UPDATE orders
        SET status = $1::varchar,
            ready_for_pickup_at = CASE WHEN $1::varchar = 'ready_for_pickup' THEN CURRENT_TIMESTAMP ELSE ready_for_pickup_at END,
            shipped_at = CASE WHEN $1::varchar = 'in_transit' THEN CURRENT_TIMESTAMP ELSE shipped_at END,
            delivered_at = CASE WHEN $1::varchar = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
            payout_date = CASE WHEN $1::varchar = 'delivered' THEN CURRENT_TIMESTAMP + INTERVAL '1 day' ELSE payout_date END,
            payout_status = CASE WHEN $1::varchar = 'delivered' THEN 'scheduled' ELSE payout_status END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND seller_id = $3
        RETURNING *
      `;

      const result = await db.query(updateQuery, [status, orderId, sellerId]);
      const updatedOrder = result.rows[0];

      // Record status change in history (manually insert with user info)
      await db.query(
        `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, order.status, status, userId, notes || null]
      );

      // Send notifications based on status change
      const emailService = require('../services/emailService');

      if (status === 'ready_for_pickup') {
        // Notify buyer order is ready
        await emailService.sendOrderStatusUpdate(updatedOrder, 'ready_for_pickup');
      } else if (status === 'in_transit') {
        // Notify buyer order is in transit
        await emailService.sendOrderStatusUpdate(updatedOrder, 'in_transit');
      } else if (status === 'delivered') {
        // Notify buyer to confirm delivery
        await emailService.sendOrderStatusUpdate(updatedOrder, 'delivered');
      }

      await db.query('COMMIT');

      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: updatedOrder,
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message,
    });
  }
};

// Get seller dashboard summary (performance optimized)
const getSellerDashboardSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get seller ID
    const sellerResult = await db.query(
      'SELECT id FROM sellers WHERE user_id = $1',
      [userId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a seller',
      });
    }

    const sellerId = sellerResult.rows[0].id;

    // Get summary from materialized view
    const summaryResult = await db.query(
      'SELECT * FROM seller_order_dashboard_summary WHERE seller_id = $1',
      [sellerId]
    );

    const summary = summaryResult.rows[0] || {
      seller_id: sellerId,
      pending_orders: 0,
      processing_orders: 0,
      ready_for_pickup_orders: 0,
      in_transit_orders: 0,
      delivered_orders: 0,
      cancelled_orders: 0,
      orders_last_24h: 0,
      orders_last_7days: 0,
      revenue_last_30days: 0,
      total_payouts_completed: 0,
      pending_payouts: 0,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Get seller dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary',
      error: error.message,
    });
  }
};

// Get orders by status for seller (with pagination and filtering)
const getSellerOrdersByStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.params;
    const { page = 1, limit = 20, search } = req.query;

    // Get seller ID
    const sellerResult = await db.query(
      'SELECT id FROM sellers WHERE user_id = $1',
      [userId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a seller',
      });
    }

    const sellerId = sellerResult.rows[0].id;

    // Build query
    let query = `
      SELECT
        o.id, o.order_number, o.total_amount, o.seller_amount, o.status, o.payment_status,
        o.delivery_name, o.delivery_phone, o.delivery_address, o.notes,
        o.estimated_delivery_date, o.created_at, o.ready_for_pickup_at, o.shipped_at, o.delivered_at,
        o.cancellation_deadline, o.payout_date, o.payout_status,
        u.first_name, u.last_name, u.email, u.phone,
        (SELECT json_agg(json_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'product_price', oi.product_price,
          'quantity', oi.quantity,
          'subtotal', oi.subtotal
        ))
        FROM order_items oi
        WHERE oi.order_id = o.id
        ) as items
      FROM orders o
      JOIN users u ON o.buyer_id = u.id
      WHERE o.seller_id = $1 AND o.payment_status = 'paid'
    `;

    const params = [sellerId];
    let paramCount = 1;

    // Filter by status if not 'all'
    if (status !== 'all') {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
    }

    // Search by order number or buyer name
    if (search) {
      paramCount++;
      query += ` AND (o.order_number ILIKE $${paramCount} OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Add ordering and pagination
    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM orders o WHERE o.seller_id = $1 AND o.payment_status = \'paid\'';
    const countParams = [sellerId];

    if (status !== 'all') {
      countQuery += ' AND o.status = $2';
      countParams.push(status);
    }

    const countResult = await db.query(countQuery, countParams);
    const totalOrders = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        orders: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalOrders,
          pages: Math.ceil(totalOrders / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get seller orders by status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
};

// Add seller note to order
const addSellerNote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { note } = req.body;

    if (!note || note.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Note cannot be empty',
      });
    }

    // Get seller ID
    const sellerResult = await db.query(
      'SELECT id FROM sellers WHERE user_id = $1',
      [userId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a seller',
      });
    }

    const sellerId = sellerResult.rows[0].id;

    // Verify order belongs to seller
    const orderCheck = await db.query(
      'SELECT id FROM orders WHERE id = $1 AND seller_id = $2',
      [orderId, sellerId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Insert note
    const result = await db.query(
      `INSERT INTO order_seller_notes (order_id, seller_id, note, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orderId, sellerId, note.trim(), userId]
    );

    res.json({
      success: true,
      message: 'Note added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Add seller note error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error.message,
    });
  }
};

// Get seller notes for an order
const getSellerNotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Get seller ID
    const sellerResult = await db.query(
      'SELECT id FROM sellers WHERE user_id = $1',
      [userId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Not a seller',
      });
    }

    const sellerId = sellerResult.rows[0].id;

    // Get notes
    const result = await db.query(
      `SELECT n.*, u.first_name, u.last_name
       FROM order_seller_notes n
       JOIN users u ON n.created_by = u.id
       WHERE n.order_id = $1 AND n.seller_id = $2
       ORDER BY n.created_at DESC`,
      [orderId, sellerId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get seller notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notes',
      error: error.message,
    });
  }
};

// Get order status history
const getOrderStatusHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;

    // Check if user is buyer or seller of this order
    const orderCheck = await db.query(
      `SELECT o.*, s.user_id as seller_user_id
       FROM orders o
       JOIN sellers s ON o.seller_id = s.id
       WHERE o.id = $1 AND (o.buyer_id = $2 OR s.user_id = $2)`,
      [orderId, userId]
    );

    if (orderCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or access denied',
      });
    }

    // Get status history
    const result = await db.query(
      `SELECT h.*, u.first_name, u.last_name
       FROM order_status_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.order_id = $1
       ORDER BY h.created_at ASC`,
      [orderId]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get order status history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order history',
      error: error.message,
    });
  }
};

// Buyer confirms delivery
const confirmDelivery = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.params;
    const { rating, feedback } = req.body; // Optional

    // Get order
    const orderResult = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND buyer_id = $2',
      [orderId, userId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderResult.rows[0];

    // Check if already delivered
    if (order.status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Order already marked as delivered',
      });
    }

    // Check if order is in transit
    if (order.status !== 'in_transit') {
      return res.status(400).json({
        success: false,
        message: 'Order must be in transit before confirming delivery',
      });
    }

    // Update order status
    await db.query(
      `UPDATE orders
       SET status = 'delivered',
           delivered_at = CURRENT_TIMESTAMP,
           payout_date = CURRENT_TIMESTAMP + INTERVAL '1 day',
           payout_status = 'scheduled',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [orderId]
    );

    // Record status change
    await db.query(
      `INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [orderId, order.status, 'delivered', userId, feedback || 'Buyer confirmed delivery']
    );

    // Send notification to seller
    const emailService = require('../services/emailService');
    await emailService.sendOrderStatusUpdate(order, 'delivered');

    res.json({
      success: true,
      message: 'Delivery confirmed successfully',
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm delivery',
      error: error.message,
    });
  }
};

module.exports = {
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
};
