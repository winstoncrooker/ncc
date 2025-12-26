-- Add featured category for profile preview
-- This determines which category's showcase appears on the small profile card

ALTER TABLE users ADD COLUMN featured_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX idx_users_featured_category ON users(featured_category_id);
