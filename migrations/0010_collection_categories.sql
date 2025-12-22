-- Migration 0010: Add category_id to collections
-- Allows items to be category-specific

-- Add category_id column to collections table
ALTER TABLE collections ADD COLUMN category_id INTEGER REFERENCES categories(id);

-- Create index for filtering by category
CREATE INDEX IF NOT EXISTS idx_collections_category ON collections(user_id, category_id);

-- Set existing collections to Vinyl Records category (id=1)
UPDATE collections SET category_id = 1 WHERE category_id IS NULL;
