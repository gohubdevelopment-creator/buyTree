import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { cartService } from '../services/api';
import { useShopContext } from './ShopContext';

const CartContext = createContext();

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({ children }) {
  const { currentShop } = useShopContext();
  const [cart, setCart] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemCount, setItemCount] = useState(0);
  const [isGuest, setIsGuest] = useState(true);

  // Track pending updates for debouncing
  const pendingUpdates = useRef({});
  const updateTimers = useRef({});
  const periodicSyncTimer = useRef(null);
  const hasTransferredCart = useRef(false); // Track if we've already transferred cart

  // LocalStorage keys
  const CART_STORAGE_KEY = 'buytree_cart_items';
  const CART_TIMESTAMP_KEY = 'buytree_cart_timestamp';
  const GUEST_CART_KEY = 'buytree_guest_cart';

  // Load guest cart from localStorage
  const loadGuestCart = () => {
    try {
      const savedCart = localStorage.getItem(GUEST_CART_KEY);
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error('Failed to load guest cart:', error);
      return [];
    }
  };

  // Save guest cart to localStorage
  const saveGuestCart = (items) => {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Failed to save guest cart:', error);
    }
  };

  // Transfer guest cart to user cart after login
  const transferGuestCartToUser = async () => {
    const guestCart = loadGuestCart();
    if (guestCart.length === 0) return;

    try {
      // Check if multi-shop guest cart
      const shopIds = [...new Set(guestCart.map(item => item.seller_id).filter(Boolean))];

      let itemsToTransfer = guestCart;

      if (shopIds.length > 1) {
        // Multiple shops in guest cart - prioritize current shop or first shop
        const currentShopId = currentShop?.id;

        if (currentShopId && shopIds.includes(currentShopId)) {
          // Transfer only current shop items
          itemsToTransfer = guestCart.filter(item => item.seller_id === currentShopId);

          console.log(`Transferring ${itemsToTransfer.length} items from ${currentShop.shop_name} (${guestCart.length - itemsToTransfer.length} items from other shops were discarded)`);
        } else {
          // No current shop context - take items from first shop only
          const firstShopId = shopIds[0];
          itemsToTransfer = guestCart.filter(item => item.seller_id === firstShopId);

          console.log(`Transferring ${itemsToTransfer.length} items from first shop (${guestCart.length - itemsToTransfer.length} items from other shops were discarded)`);
        }
      }

      // Add selected items to user cart
      for (const item of itemsToTransfer) {
        await cartService.addToCart(item.product_id, item.quantity);
      }

      // Clear guest cart
      localStorage.removeItem(GUEST_CART_KEY);

      // Refresh user cart
      await fetchCart();
    } catch (error) {
      console.error('Failed to transfer guest cart:', error);
    }
  };

  // Load cart from localStorage or server on mount
  useEffect(() => {
    initializeCart();

    // Set up periodic sync every 5 minutes (only for logged in users)
    periodicSyncTimer.current = setInterval(() => {
      if (!isGuest) {
        syncPendingUpdates();
      }
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

  // Watch for authentication changes and transfer guest cart
  useEffect(() => {
    const checkAuthAndTransferCart = async () => {
      const token = localStorage.getItem('token');
      const guestCart = loadGuestCart();

      // If user just logged in and has a guest cart that hasn't been transferred yet
      if (token && guestCart.length > 0 && !hasTransferredCart.current) {
        hasTransferredCart.current = true;
        setIsGuest(false);
        await transferGuestCartToUser();
      } else if (token && guestCart.length === 0) {
        // User logged in but no guest cart
        setIsGuest(false);
        if (hasTransferredCart.current) {
          // Cart was just transferred, refresh from server
          await fetchCart();
          hasTransferredCart.current = false;
        }
      } else if (!token) {
        // User logged out
        setIsGuest(true);
        hasTransferredCart.current = false;
      }
    };

    // Check periodically for auth changes (handles login from other components)
    checkAuthAndTransferCart();
    const authCheckInterval = setInterval(checkAuthAndTransferCart, 1000);

    return () => clearInterval(authCheckInterval);
  }, []);

  useEffect(() => {
    // Calculate unique item count (number of different products, not total quantity)
    const count = cartItems.length;
    setItemCount(count);

    // Save to localStorage whenever cart changes
    if (isGuest) {
      saveGuestCart(cartItems);
    } else {
      saveCartToLocalStorage(cartItems);
    }
  }, [cartItems, isGuest]);

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
      // Guest user - load from guest cart
      setIsGuest(true);
      const guestCart = loadGuestCart();
      setCartItems(guestCart);
      setLoading(false);
      return;
    }

    // Logged in user
    setIsGuest(false);

    // Check if there's a guest cart to transfer
    const guestCart = loadGuestCart();
    if (guestCart.length > 0) {
      await transferGuestCartToUser();
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

  const addToCart = async (productId, quantity = 1, productData = null) => {
    try {
      // Check for multi-shop cart (shop isolation enforcement)
      if (cartItems.length > 0) {
        const currentCartShopId = cartItems[0].seller_id;
        const newItemShopId = productData?.seller_id;

        if (currentCartShopId && newItemShopId && currentCartShopId !== newItemShopId) {
          const currentCartShopName = cartItems[0].shop_name || 'another shop';
          const confirmed = window.confirm(
            `Your cart contains items from ${currentCartShopName}. Adding this item will clear your current cart. Continue?`
          );

          if (!confirmed) {
            return { success: false, message: 'Cart not modified' };
          }

          // Clear cart before adding from different shop
          await clearCart();
        }
      }

      if (isGuest) {
        // Guest cart - add to localStorage
        const currentCart = loadGuestCart();
        const existingItem = currentCart.find(item => item.product_id === productId);

        if (existingItem) {
          existingItem.quantity += quantity;
        } else {
          currentCart.push({
            product_id: productId,
            quantity,
            ...productData, // Include product details for display
          });
        }

        setCartItems(currentCart);
        saveGuestCart(currentCart);
        return { success: true };
      } else {
        // Logged in user - add to server
        await cartService.addToCart(productId, quantity);
        await fetchCart(); // Refresh cart
        return { success: true };
      }
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

    if (isGuest) {
      // Guest cart - just update localStorage
      return { success: true };
    }

    // Logged in user - debounce server update
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
      if (isGuest) {
        // Guest cart - just update localStorage
        return { success: true };
      }

      // Logged in user - remove from server
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
      // Clear all pending update timers
      Object.keys(updateTimers.current).forEach(productId => {
        clearTimeout(updateTimers.current[productId]);
      });
      updateTimers.current = {};
      pendingUpdates.current = {};

      if (isGuest) {
        // Guest cart - clear localStorage
        localStorage.removeItem(GUEST_CART_KEY);
      } else {
        // Logged in user - clear server cart
        await cartService.clearCart();
        // Explicitly clear localStorage
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(CART_TIMESTAMP_KEY);
      }

      setCartItems([]);
      setCart(null);

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
    if (isGuest) return;

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
    if (isGuest) return;

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

  // Get cart item count for current shop only
  const getCurrentShopItemCount = () => {
    if (!currentShop) return cartItems.length;
    return cartItems.filter(item => item.seller_id === currentShop.id).length;
  };

  const value = {
    cart,
    cartItems,
    loading,
    itemCount,
    currentShopItemCount: getCurrentShopItemCount(),
    isGuest,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getCartTotal,
    refreshCart: fetchCart,
    syncPendingUpdates,
    transferGuestCartToUser,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
