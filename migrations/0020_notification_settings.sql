-- Notification settings for email preferences
-- Each user can control which types of notifications they receive

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id INTEGER PRIMARY KEY,
  email_friend_requests INTEGER DEFAULT 1,
  email_messages INTEGER DEFAULT 1,
  email_forum_replies INTEGER DEFAULT 1,
  email_offers INTEGER DEFAULT 1,
  email_sales INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_notification_settings_user ON notification_settings(user_id);
