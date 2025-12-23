-- Wishlist / Currently Seeking Feature
-- Migration 0017

CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,           -- Item name/title (e.g., album name, card name)
    description TEXT,              -- Additional details
    artist TEXT,                   -- Artist/manufacturer (for vinyl, etc.)
    year INTEGER,                  -- Year if known
    condition_wanted TEXT,         -- Desired condition
    max_price REAL,               -- Max price willing to pay
    priority INTEGER DEFAULT 0,    -- 0=low, 1=medium, 2=high
    is_found INTEGER DEFAULT 0,    -- Mark when found
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Indexes for wishlist
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id, is_found);
CREATE INDEX IF NOT EXISTS idx_wishlist_category ON wishlist(category_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_priority ON wishlist(user_id, priority DESC);
