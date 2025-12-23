-- Profile Enhancements: Location, External Links
-- Migration 0015

-- Add location field for local meetups/trades
ALTER TABLE users ADD COLUMN location TEXT;

-- Add external links (JSON object for various platform links)
ALTER TABLE users ADD COLUMN external_links TEXT DEFAULT '{}';

-- Add user flair/badges JSON
ALTER TABLE users ADD COLUMN flair TEXT DEFAULT '[]';

-- Add verified seller flag
ALTER TABLE users ADD COLUMN is_verified_seller INTEGER DEFAULT 0;

-- Create index for location-based search
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location);
