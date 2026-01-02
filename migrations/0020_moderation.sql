-- Migration 0020: Content Moderation System
-- Reports, moderation actions, and user warnings

-- Reports table - user-submitted reports on content
CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER NOT NULL,
    content_type TEXT NOT NULL CHECK(content_type IN ('post', 'comment', 'listing', 'profile', 'message')),
    content_id INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK(reason IN ('spam', 'harassment', 'inappropriate', 'scam', 'other')),
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    reviewed_by INTEGER,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Moderation actions table - actions taken by admins
CREATE TABLE moderation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER,
    action_type TEXT NOT NULL CHECK(action_type IN ('warn', 'hide', 'delete', 'suspend', 'ban')),
    target_user_id INTEGER NOT NULL,
    moderator_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User warnings table - warnings issued to users
CREATE TABLE user_warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    warning_type TEXT NOT NULL,
    message TEXT NOT NULL,
    issued_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_content ON reports(content_type, content_id);
CREATE INDEX idx_reports_created ON reports(created_at DESC);
CREATE INDEX idx_moderation_actions_target ON moderation_actions(target_user_id);
CREATE INDEX idx_moderation_actions_report ON moderation_actions(report_id);
CREATE INDEX idx_user_warnings_user ON user_warnings(user_id);
