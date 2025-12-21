-- Migration: Add profile fields for Niche Collector Connector
-- Created: 2025-12-21

-- Add profile fields to users table
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN pronouns TEXT;
ALTER TABLE users ADD COLUMN background_image TEXT;

-- Showcase albums table (featured records on profile)
CREATE TABLE IF NOT EXISTS showcase_albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    UNIQUE(user_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_showcase_user ON showcase_albums(user_id);
CREATE INDEX IF NOT EXISTS idx_showcase_position ON showcase_albums(user_id, position);
