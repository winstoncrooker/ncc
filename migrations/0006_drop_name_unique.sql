-- Drop the UNIQUE constraint on users.name
-- This was incorrectly added in 0004 - multiple Google users can have the same display name
DROP INDEX IF EXISTS idx_users_name_unique;
