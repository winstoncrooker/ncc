-- Migration 0008: Forums - Posts, Comments, Votes
-- Forum functionality with nested comments and voting

-- Forum posts
CREATE TABLE forum_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    interest_group_id INTEGER,
    post_type TEXT NOT NULL DEFAULT 'discussion',  -- discussion, showcase, wtt_wts, question, poll, event
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    images TEXT,           -- JSON array of image URLs
    upvote_count INTEGER DEFAULT 0,
    downvote_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    hot_score REAL DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (interest_group_id) REFERENCES interest_groups(id) ON DELETE SET NULL
);

-- Nested comments (supports 3 levels of nesting)
CREATE TABLE forum_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    parent_comment_id INTEGER,  -- NULL = top-level comment
    body TEXT NOT NULL,
    upvote_count INTEGER DEFAULT 0,
    downvote_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE
);

-- Votes (for both posts and comments)
CREATE TABLE votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER,
    comment_id INTEGER,
    value INTEGER NOT NULL,  -- 1 = upvote, -1 = downvote
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE,
    UNIQUE(user_id, post_id),
    UNIQUE(user_id, comment_id)
);

-- Saved/bookmarked posts
CREATE TABLE saved_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    UNIQUE(user_id, post_id)
);

-- Indexes for performance
CREATE INDEX idx_forum_posts_category ON forum_posts(category_id);
CREATE INDEX idx_forum_posts_interest ON forum_posts(interest_group_id);
CREATE INDEX idx_forum_posts_user ON forum_posts(user_id);
CREATE INDEX idx_forum_posts_hot ON forum_posts(hot_score DESC);
CREATE INDEX idx_forum_posts_created ON forum_posts(created_at DESC);
CREATE INDEX idx_forum_posts_type ON forum_posts(post_type);
CREATE INDEX idx_forum_comments_post ON forum_comments(post_id);
CREATE INDEX idx_forum_comments_user ON forum_comments(user_id);
CREATE INDEX idx_forum_comments_parent ON forum_comments(parent_comment_id);
CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_votes_post ON votes(post_id);
CREATE INDEX idx_votes_comment ON votes(comment_id);
CREATE INDEX idx_saved_posts_user ON saved_posts(user_id);
