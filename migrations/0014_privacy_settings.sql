-- Migration 0014: Privacy Settings
-- Add privacy settings column to users table

ALTER TABLE users ADD COLUMN privacy_settings TEXT DEFAULT '{"profile_visibility":"public","show_collection":true,"show_showcase":true,"searchable":true}';

-- Index for quick lookups of public profiles
CREATE INDEX IF NOT EXISTS idx_users_privacy ON users(privacy_settings);
