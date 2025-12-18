const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d' // Token valid for 7 days
  });
};

// Signup
const signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, registeredViaShopSlug } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Lookup seller_id from shop_slug if provided
    let registeredViaShopId = null;
    if (registeredViaShopSlug) {
      const sellerResult = await db.query(
        'SELECT id FROM sellers WHERE shop_slug = $1',
        [registeredViaShopSlug]
      );
      if (sellerResult.rows.length > 0) {
        registeredViaShopId = sellerResult.rows[0].id;
      }
    }

    // Insert user with shop tracking
    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, registered_via_shop_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, phone, role, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, phone, registeredViaShopId]
    );

    const user = result.rows[0];

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create account',
      error: error.message
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Get user
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is a seller
    let sellerId = null;
    if (user.role === 'seller' || user.role === 'both') {
      const sellerResult = await db.query(
        'SELECT id FROM sellers WHERE user_id = $1',
        [user.id]
      );
      if (sellerResult.rows.length > 0) {
        sellerId = sellerResult.rows[0].id;
      }
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          sellerId
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Get current user (protected route)
const getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user details
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name, phone, role FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];
    let seller = null;

    // If user is a seller, get seller details
    if (user.role === 'seller' || user.role === 'both') {
      const sellerResult = await db.query(
        'SELECT id, shop_name, shop_slug, is_verified FROM sellers WHERE user_id = $1',
        [userId]
      );
      if (sellerResult.rows.length > 0) {
        seller = sellerResult.rows[0];
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
          seller
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user details',
      error: error.message
    });
  }
};

module.exports = { signup, login, getMe };
