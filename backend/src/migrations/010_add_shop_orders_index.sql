-- Migration 010: Add shop orders indexes
-- Optimizes shop-specific order queries for better performance

-- Add composite index for buyer + seller orders
CREATE INDEX IF NOT EXISTS idx_orders_buyer_seller
ON orders(buyer_id, seller_id);

-- Add composite index with created_at for sorting
CREATE INDEX IF NOT EXISTS idx_orders_buyer_seller_created
ON orders(buyer_id, seller_id, created_at DESC);

-- Add comment for documentation
COMMENT ON INDEX idx_orders_buyer_seller IS
  'Optimizes queries filtering orders by buyer and seller';

COMMENT ON INDEX idx_orders_buyer_seller_created IS
  'Optimizes queries filtering orders by buyer and seller with date sorting';

-- Rollback script (commented out):
-- DROP INDEX IF EXISTS idx_orders_buyer_seller;
-- DROP INDEX IF EXISTS idx_orders_buyer_seller_created;
