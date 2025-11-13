import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { cartService } from '../services/api';

const CartContext = createContext();

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemCount, setItemCount] = useState(0);

  // Track pending updates for debouncing
  const pendingUpdates = useRef({});
  const updateTimers = useRef({});
  const periodicSyncTimer = useRef(null);

  // LocalStorage keys
  const CART_STORAGE_KEY = 'buytree_cart_items';
  const CART_TIMESTAMP_KEY = 'buytree_cart_timestamp';

  // Load cart from localStorage or server on mount
  useEffect(() => {
    initializeCart();

    // Set up periodic sync every 5 minutes
    periodicSyncTimer.current = setInterval(() => {
      syncPendingUpdates();
    }, 5 * 60 * 1000);

    // Set up beforeunload listener to sync on tab close
    const handleBeforeUnload = () => {
      // Sync any pending updates before page unload
      if (Object.keys(pendingUpdates.current).length > 0) {
        syncPendingUpdatesBeforeUnload();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      if (periodicSyncTimer.current) {
        clearInterval(periodicSyncTimer.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    // Calculate total item count
    const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    setItemCount(count);

    // Save to localStorage whenever cart changes
    saveCartToLocalStorage(cartItems);
  }, [cartItems]);

  // Save cart to localStorage
  const saveCartToLocalStorage = (items) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      localStorage.setItem(CART_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  };

  // Load cart from localStorage
  const loadCartFromLocalStorage = () => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      const timestamp = localStorage.getItem(CART_TIMESTAMP_KEY);

      if (savedCart && timestamp) {
        const items = JSON.parse(savedCart);
        const age = Date.now() - parseInt(timestamp);

        // Use cached cart if less than 1 hour old
        if (age < 60 * 60 * 1000) {
          return items;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
      return null;
    }
  };

  // Initialize cart - load from cache first, then sync with server
  const initializeCart = async () => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    // Load from localStorage immediately for instant UI
    const cachedCart = loadCartFromLocalStorage();
    if (cachedCart && cachedCart.length > 0) {
      setCartItems(cachedCart);
      setLoading(false);

      // Fetch from server in background and merge
      fetchAndMergeCart();
    } else {
      // No cache, fetch from server
      await fetchCart();
    }
  };

  // Fetch cart from server and merge with local changes
  const fetchAndMergeCart = async () => {
    try {
      const response = await cartService.getCart();
      const serverItems = response.data.items || [];

      setCart(response.data.cart);

      // Merge with pending updates
      const mergedItems = serverItems.map(item => {
        const pendingQty = pendingUpdates.current[item.product_id];
        return pendingQty !== undefined
          ? { ...item, quantity: pendingQty }
          : item;
      });

      setCartItems(mergedItems);
    } catch (error) {
      console.error('Failed to fetch and merge cart:', error);
    }
  };

  const fetchCart = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await cartService.getCart();
      setCart(response.data.cart);
      setCartItems(response.data.items || []);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
      setCartItems([]);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (productId, quantity = 1) => {
    try {
      await cartService.addToCart(productId, quantity);
      await fetchCart(); // Refresh cart
      return { success: true };
    } catch (error) {
      console.error('Failed to add to cart:', error);
      return { success: false, error: error.response?.data?.message || 'Failed to add to cart' };
    }
  };

  // Sync pending update to server
  const syncUpdateToServer = async (productId, quantity) => {
    try {
      await cartService.updateCartItem(productId, quantity);
      delete pendingUpdates.current[productId];
      return { success: true };
    } catch (error) {
      console.error('Failed to update quantity:', error);
      // Revert optimistic update on error
      await fetchCart();
      return { success: false, error: error.response?.data?.message || 'Failed to update quantity' };
    }
  };

  const updateQuantity = async (productId, quantity) => {
    // Optimistic update - update UI immediately
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.product_id === productId
          ? { ...item, quantity }
          : item
      )
    );

    // Store pending update
    pendingUpdates.current[productId] = quantity;

    // Clear existing timer for this product
    if (updateTimers.current[productId]) {
      clearTimeout(updateTimers.current[productId]);
    }

    // Debounce: sync to server after 800ms of no changes
    updateTimers.current[productId] = setTimeout(() => {
      syncUpdateToServer(productId, quantity);
      delete updateTimers.current[productId];
    }, 800);

    return { success: true };
  };

  const removeFromCart = async (productId) => {
    // Optimistic update - remove from UI immediately
    const originalItems = [...cartItems];
    setCartItems(prevItems => prevItems.filter(item => item.product_id !== productId));

    try {
      // Clear any pending update timer
      if (updateTimers.current[productId]) {
        clearTimeout(updateTimers.current[productId]);
        delete updateTimers.current[productId];
      }
      delete pendingUpdates.current[productId];

      await cartService.removeFromCart(productId);
      return { success: true };
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      // Revert optimistic update on error
      setCartItems(originalItems);
      return { success: false, error: error.response?.data?.message || 'Failed to remove from cart' };
    }
  };

  const clearCart = async () => {
    try {
      await cartService.clearCart();
      setCartItems([]);
      return { success: true };
    } catch (error) {
      console.error('Failed to clear cart:', error);
      return { success: false, error: error.response?.data?.message || 'Failed to clear cart' };
    }
  };

  const getCartTotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // Synchronous sync for beforeunload (uses sendBeacon or synchronous XHR as fallback)
  const syncPendingUpdatesBeforeUnload = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Send cart state to server using sendBeacon (reliable during page unload)
    const updates = Object.entries(pendingUpdates.current).map(([productId, quantity]) => ({
      productId: parseInt(productId),
      quantity
    }));

    if (updates.length > 0) {
      const blob = new Blob([JSON.stringify({ updates })], { type: 'application/json' });
      navigator.sendBeacon('/api/cart/batch-update', blob);
    }
  };

  // Sync all pending updates before checkout
  const syncPendingUpdates = async () => {
    const promises = Object.entries(pendingUpdates.current).map(([productId, quantity]) => {
      // Clear timer and sync immediately
      if (updateTimers.current[productId]) {
        clearTimeout(updateTimers.current[productId]);
        delete updateTimers.current[productId];
      }
      return syncUpdateToServer(parseInt(productId), quantity);
    });

    await Promise.all(promises);
    await fetchCart(); // Refresh to ensure everything is in sync
  };

  const value = {
    cart,
    cartItems,
    loading,
    itemCount,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    refreshCart: fetchCart,
    syncPendingUpdates,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
