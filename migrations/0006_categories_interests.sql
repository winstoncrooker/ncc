-- Migration 0006: Categories and Interest Groups
-- Creates the foundation for multi-category collector platform

-- Categories table (8 main collecting categories)
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    item_noun_singular TEXT NOT NULL,
    item_noun_plural TEXT NOT NULL,
    item_schema TEXT,      -- JSON schema for category items
    profile_schema TEXT,   -- JSON schema for profile fields
    ai_system_prompt TEXT, -- Category-specific AI prompt
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hierarchical interest groups (3 levels max)
-- Level 1: Sub-group (parent_id = NULL)
-- Level 2: Micro-community (parent_id = sub-group id)
CREATE TABLE interest_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    parent_id INTEGER,     -- NULL = sub-group, ID = micro-community
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    member_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES interest_groups(id) ON DELETE CASCADE,
    UNIQUE(category_id, parent_id, slug)
);

-- User interest memberships (category-level and group-level)
CREATE TABLE user_interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER,
    interest_group_id INTEGER,
    notify_all INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (interest_group_id) REFERENCES interest_groups(id) ON DELETE CASCADE,
    UNIQUE(user_id, category_id),
    UNIQUE(user_id, interest_group_id)
);

-- Indexes for performance
CREATE INDEX idx_interest_groups_category ON interest_groups(category_id);
CREATE INDEX idx_interest_groups_parent ON interest_groups(parent_id);
CREATE INDEX idx_user_interests_user ON user_interests(user_id);
CREATE INDEX idx_user_interests_category ON user_interests(category_id);
CREATE INDEX idx_user_interests_group ON user_interests(interest_group_id);
