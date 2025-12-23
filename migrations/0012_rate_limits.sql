-- Migration 0012: Add rate_limits table for API rate limiting

CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_hash TEXT NOT NULL,
    timestamp INTEGER NOT NULL
);

-- Index for efficient lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_client ON rate_limits(client_hash, timestamp);
CREATE INDEX IF NOT EXISTS idx_rate_limits_timestamp ON rate_limits(timestamp);
