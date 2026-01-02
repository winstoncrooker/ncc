-- Migration: Add blocked_users table
-- Description: User blocking functionality for privacy and safety

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id INTEGER PRIMARY KEY,
  blocker_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(blocker_id, blocked_id)
);

-- Create indexes for efficient lookups
-- Index for finding users blocked by a specific user
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id);

-- Index for finding users who have blocked a specific user
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id);

-- Compound index for quick bi-directional block checks
CREATE INDEX IF NOT EXISTS idx_blocked_users_both ON blocked_users(blocker_id, blocked_id);
