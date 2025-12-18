-- Migration 009: Add shop registration tracking
-- This allows tracking which shop a customer registered through for analytics and attribution

-- Add registered_via_shop_id column to users table
ALTER TABLE users
ADD COLUMN registered_via_shop_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL;

-- Add index for efficient analytics queries
CREATE INDEX idx_users_registered_shop ON users(registered_via_shop_id);

-- Add comment for documentation
COMMENT ON COLUMN users.registered_via_shop_id IS
  'Tracks which shop the user registered through for analytics and attribution';

-- Rollback script (commented out):
-- DROP INDEX IF EXISTS idx_users_registered_shop;
-- ALTER TABLE users DROP COLUMN IF EXISTS registered_via_shop_id;
