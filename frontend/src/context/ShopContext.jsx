import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { sellerService } from '../services/api';

const ShopContext = createContext();

export const useShopContext = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShopContext must be used within ShopContextProvider');
  }
  return context;
};

export const ShopContextProvider = ({ children }) => {
  const [currentShop, setCurrentShop] = useState(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const initializeShopContext = async () => {
      // Restore from sessionStorage on mount
      const saved = sessionStorage.getItem('buytree_current_shop');
      if (saved) {
        try {
          const parsedShop = JSON.parse(saved);
          setCurrentShop(parsedShop);
        } catch (error) {
          console.error('Error parsing saved shop:', error);
          sessionStorage.removeItem('buytree_current_shop');
        }
      }

      // Detect shop from URL: /shop/:shopSlug
      const match = location.pathname.match(/^\/shop\/([^\/]+)/);
      if (match) {
        const shopSlug = match[1];
        // Only fetch if not already the current shop
        if (!currentShop || currentShop.shop_slug !== shopSlug) {
          await fetchAndSetShop(shopSlug);
        }
      } else if (!location.pathname.startsWith('/shop') && !location.pathname.startsWith('/cart') && !location.pathname.startsWith('/checkout') && !location.pathname.startsWith('/orders')) {
        // Left shop context - clear (except for cart, checkout, orders which maintain shop context)
        clearCurrentShop();
      }
    };

    initializeShopContext();
  }, [location.pathname]);

  const fetchAndSetShop = async (shopSlug) => {
    try {
      setLoading(true);
      const response = await sellerService.getSellerBySlug(shopSlug);
      const shop = response.data.seller;
      setCurrentShop(shop);
      sessionStorage.setItem('buytree_current_shop', JSON.stringify(shop));
    } catch (error) {
      console.error('Error fetching shop:', error);
      clearCurrentShop();
    } finally {
      setLoading(false);
    }
  };

  const clearCurrentShop = () => {
    setCurrentShop(null);
    sessionStorage.removeItem('buytree_current_shop');
  };

  const updateCurrentShop = (shop) => {
    setCurrentShop(shop);
    if (shop) {
      sessionStorage.setItem('buytree_current_shop', JSON.stringify(shop));
    } else {
      sessionStorage.removeItem('buytree_current_shop');
    }
  };

  const isInShop = () => {
    return currentShop !== null;
  };

  const value = {
    currentShop,
    setCurrentShop: updateCurrentShop,
    clearCurrentShop,
    isInShop,
    loading,
  };

  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  );
};
