-- Migration 0013: Token blacklist for session invalidation

CREATE TABLE IF NOT EXISTS token_blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);
