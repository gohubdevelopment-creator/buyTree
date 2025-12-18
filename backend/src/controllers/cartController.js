const db = require('../config/database');

// Get user's cart with items
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create cart for user
    let cartResult = await db.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [userId]
    );

    let cartId;
    if (cartResult.rows.length === 0) {
      // Create cart if doesn't exist
      const newCart = await db.query(
        'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
        [userId]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
    }

    // Get cart items with product details
    const itemsResult = await db.query(
      `SELECT
        ci.id,
        ci.product_id,
        ci.quantity,
        p.name,
        p.price,
        p.quantity_available,
        p.image_urls,
        p.slug,
        s.id as seller_id,
        s.shop_name,
        s.shop_slug
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      JOIN sellers s ON p.seller_id = s.id
      WHERE ci.cart_id = $1 AND p.deleted_at IS NULL
      ORDER BY ci.created_at DESC`,
      [cartId]
    );

    res.json({
      success: true,
      data: {
        cart: { id: cartId },
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cart',
      error: error.message,
    });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1 } = req.body;

    if (!productId || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID and quantity are required',
      });
    }

    // Check if product exists and is available
    const productResult = await db.query(
      'SELECT id, quantity_available FROM products WHERE id = $1 AND deleted_at IS NULL',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const product = productResult.rows[0];
    if (product.quantity_available < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity_available} items available in stock`,
      });
    }

    // Get or create cart
    let cartResult = await db.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [userId]
    );

    let cartId;
    if (cartResult.rows.length === 0) {
      const newCart = await db.query(
        'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
        [userId]
      );
      cartId = newCart.rows[0].id;
    } else {
      cartId = cartResult.rows[0].id;
    }

    // SHOP ISOLATION: Check existing cart items for shop consistency
    const existingItems = await db.query(
      `SELECT ci.*, p.seller_id
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1`,
      [cartId]
    );

    if (existingItems.rows.length > 0) {
      const existingShopId = existingItems.rows[0].seller_id;

      // Check new product's shop
      const newProductShop = await db.query(
        'SELECT seller_id FROM products WHERE id = $1',
        [productId]
      );

      const newShopId = newProductShop.rows[0].seller_id;

      if (existingShopId !== newShopId) {
        return res.status(400).json({
          success: false,
          message: 'Cart can only contain items from one shop. Please clear your cart first.',
          code: 'MULTI_SHOP_CART_ERROR'
        });
      }
    }

    // Check if item already in cart
    const existingItem = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
      [cartId, productId]
    );

    if (existingItem.rows.length > 0) {
      // Update quantity
      const newQuantity = existingItem.rows[0].quantity + quantity;

      if (newQuantity > product.quantity_available) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more items. Only ${product.quantity_available} available in stock`,
        });
      }

      await db.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2',
        [newQuantity, existingItem.rows[0].id]
      );
    } else {
      // Add new item
      await db.query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
        [cartId, productId, quantity]
      );
    }

    // Update cart timestamp
    await db.query(
      'UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [cartId]
    );

    res.json({
      success: true,
      message: 'Item added to cart',
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: error.message,
    });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity } = req.body;

    if (!productId || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID and quantity are required',
      });
    }

    // Get user's cart
    const cartResult = await db.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const cartId = cartResult.rows[0].id;

    // Check product availability
    const productResult = await db.query(
      'SELECT quantity_available FROM products WHERE id = $1 AND deleted_at IS NULL',
      [productId]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    if (quantity > productResult.rows[0].quantity_available) {
      return res.status(400).json({
        success: false,
        message: `Only ${productResult.rows[0].quantity_available} items available`,
      });
    }

    // Update cart item
    const result = await db.query(
      'UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3 RETURNING id',
      [quantity, cartId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    // Update cart timestamp
    await db.query(
      'UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [cartId]
    );

    res.json({
      success: true,
      message: 'Cart updated',
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cart',
      error: error.message,
    });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    // Get user's cart
    const cartResult = await db.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [userId]
    );

    if (cartResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
      });
    }

    const cartId = cartResult.rows[0].id;

    // Remove item
    const result = await db.query(
      'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2 RETURNING id',
      [cartId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      });
    }

    // Update cart timestamp
    await db.query(
      'UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [cartId]
    );

    res.json({
      success: true,
      message: 'Item removed from cart',
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
      error: error.message,
    });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's cart
    const cartResult = await db.query(
      'SELECT id FROM carts WHERE user_id = $1',
      [userId]
    );

    if (cartResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Cart is already empty',
      });
    }

    const cartId = cartResult.rows[0].id;

    // Delete all cart items
    await db.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

    // Update cart timestamp
    await db.query(
      'UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [cartId]
    );

    res.json({
      success: true,
      message: 'Cart cleared',
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: error.message,
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
