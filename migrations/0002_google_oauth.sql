-- Add Google OAuth support
-- Run: CLOUDFLARE_ACCOUNT_ID=9afe1741eb5cf958177ce6cc0acdf6fd wrangler d1 execute vinyl-vault --file=migrations/0002_google_oauth.sql --remote

-- Add google_id column for OAuth linking (unique enforced by index)
ALTER TABLE users ADD COLUMN google_id TEXT;

-- Add name and picture from Google profile
ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN picture TEXT;

-- Create unique index for Google ID lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
