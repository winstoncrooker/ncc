-- Add case-insensitive unique constraint on users.name
-- This prevents "Winston Crooker" and "winston crooker" from both existing
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_unique_nocase ON users(name COLLATE NOCASE);
