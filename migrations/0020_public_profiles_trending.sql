-- Migration 0020: Public Profiles and Trending Features
-- Adds username slug for shareable URLs and indexes for trending queries

-- Add username_slug for shareable profile URLs (unique, lowercase)
-- Note: SQLite doesn't support ADD COLUMN with UNIQUE, so we add column then create unique index
ALTER TABLE users ADD COLUMN username_slug TEXT;

-- Create unique index for username slug lookups (enforces uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_slug ON users(username_slug);

-- Index for trending users queries (activity-based)
CREATE INDEX IF NOT EXISTS idx_forum_posts_user_count ON forum_posts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_forum_comments_user_count ON forum_comments(user_id, created_at);

-- Index for public profile lookups based on privacy settings
CREATE INDEX IF NOT EXISTS idx_users_public ON users(id) WHERE json_extract(privacy_settings, '$.profile_visibility') = 'public';
