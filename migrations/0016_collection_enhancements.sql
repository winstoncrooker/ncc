-- Collection Enhancements: Item Tags, Condition, Notes
-- Migration 0016

-- Add tags to collection items (JSON array: ["for_trade", "grail", "not_for_sale"])
ALTER TABLE collections ADD COLUMN tags TEXT DEFAULT '[]';

-- Add condition/grading field (varies by category)
ALTER TABLE collections ADD COLUMN condition TEXT;

-- Add personal notes for items
ALTER TABLE collections ADD COLUMN notes TEXT;

-- Add showcase notes (why this item is special)
ALTER TABLE showcase_albums ADD COLUMN notes TEXT;

-- Create indexes for tag searching
CREATE INDEX IF NOT EXISTS idx_collections_tags ON collections(tags);
