// Cache utility for client-side data caching with TTL support

class Cache {
  constructor(prefix = 'buytree_cache') {
    this.prefix = prefix;
  }

  /**
   * Generate cache key
   */
  generateKey(key) {
    return `${this.prefix}_${key}`;
  }

  /**
   * Set cache with TTL (time to live in milliseconds)
   */
  set(key, data, ttl = 10 * 60 * 1000) { // Default 10 minutes
    try {
      const cacheKey = this.generateKey(key);
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get cached data if not expired
   */
  get(key) {
    try {
      const cacheKey = this.generateKey(key);
      const cached = localStorage.getItem(cacheKey);

      if (!cached) {
        return null;
      }

      const cacheData = JSON.parse(cached);
      const age = Date.now() - cacheData.timestamp;

      // Check if expired
      if (age > cacheData.ttl) {
        this.delete(key);
        return null;
      }

      return cacheData.data;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete specific cache entry
   */
  delete(key) {
    try {
      const cacheKey = this.generateKey(key);
      localStorage.removeItem(cacheKey);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries with this prefix
   */
  clearAll() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Cache clearAll error:', error);
      return false;
    }
  }

  /**
   * Check if cache exists and is valid
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Get cache age in milliseconds
   */
  getAge(key) {
    try {
      const cacheKey = this.generateKey(key);
      const cached = localStorage.getItem(cacheKey);

      if (!cached) {
        return null;
      }

      const cacheData = JSON.parse(cached);
      return Date.now() - cacheData.timestamp;
    } catch (error) {
      console.error('Cache getAge error:', error);
      return null;
    }
  }
}

// Export singleton instances for different cache types
export const productCache = new Cache('buytree_products');
export const shopCache = new Cache('buytree_shops');
export const searchCache = new Cache('buytree_search');

export default Cache;
