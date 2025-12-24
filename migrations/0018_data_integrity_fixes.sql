-- Migration 0018: Data Integrity Fixes
-- Adds missing constraints and validation triggers
-- Note: SQLite doesn't support adding CHECK constraints via ALTER TABLE,
-- so we use triggers for validation instead.

-- Trigger to validate vote values (must be 1 or -1)
CREATE TRIGGER IF NOT EXISTS validate_vote_value
BEFORE INSERT ON votes
BEGIN
    SELECT CASE
        WHEN NEW.value NOT IN (1, -1) THEN
            RAISE(ABORT, 'Vote value must be 1 or -1')
    END;
END;

-- Trigger to validate vote update values
CREATE TRIGGER IF NOT EXISTS validate_vote_value_update
BEFORE UPDATE ON votes
BEGIN
    SELECT CASE
        WHEN NEW.value NOT IN (1, -1) THEN
            RAISE(ABORT, 'Vote value must be 1 or -1')
    END;
END;

-- Trigger to ensure exactly one of post_id or comment_id is set in votes
CREATE TRIGGER IF NOT EXISTS validate_vote_target
BEFORE INSERT ON votes
BEGIN
    SELECT CASE
        WHEN (NEW.post_id IS NULL AND NEW.comment_id IS NULL) THEN
            RAISE(ABORT, 'Vote must have either post_id or comment_id')
        WHEN (NEW.post_id IS NOT NULL AND NEW.comment_id IS NOT NULL) THEN
            RAISE(ABORT, 'Vote cannot have both post_id and comment_id')
    END;
END;

-- Trigger to validate wishlist priority (0, 1, or 2)
CREATE TRIGGER IF NOT EXISTS validate_wishlist_priority
BEFORE INSERT ON wishlist
BEGIN
    SELECT CASE
        WHEN NEW.priority NOT IN (0, 1, 2) THEN
            RAISE(ABORT, 'Wishlist priority must be 0, 1, or 2')
    END;
END;

-- Trigger to validate wishlist priority on update
CREATE TRIGGER IF NOT EXISTS validate_wishlist_priority_update
BEFORE UPDATE ON wishlist
BEGIN
    SELECT CASE
        WHEN NEW.priority NOT IN (0, 1, 2) THEN
            RAISE(ABORT, 'Wishlist priority must be 0, 1, or 2')
    END;
END;

-- Index for faster message queries by timestamp (if not exists)
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Index for friend_requests status queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);
