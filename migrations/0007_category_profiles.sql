-- Migration 0007: Category Profiles and Items
-- Per-category user profiles and generic items table

-- Per-category user profiles
CREATE TABLE category_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    display_name TEXT,
    bio TEXT,
    avatar TEXT,
    background_image TEXT,
    custom_fields TEXT,    -- JSON for category-specific fields
    item_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(user_id, category_id)
);

-- Generic items table (replaces category-specific collections)
CREATE TABLE category_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    cover_image TEXT,
    year INTEGER,
    external_id TEXT,
    external_source TEXT,
    purchase_price REAL,
    current_value REAL,
    condition TEXT,
    metadata TEXT,         -- JSON for category-specific fields
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Per-category showcase
CREATE TABLE category_showcase (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    position INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES category_items(id) ON DELETE CASCADE,
    UNIQUE(user_id, category_id, item_id)
);

-- Indexes for performance
CREATE INDEX idx_category_profiles_user ON category_profiles(user_id);
CREATE INDEX idx_category_profiles_category ON category_profiles(category_id);
CREATE INDEX idx_category_items_user ON category_items(user_id);
CREATE INDEX idx_category_items_category ON category_items(category_id);
CREATE INDEX idx_category_items_user_category ON category_items(user_id, category_id);
CREATE INDEX idx_category_showcase_user ON category_showcase(user_id);
CREATE INDEX idx_category_showcase_category ON category_showcase(category_id);
