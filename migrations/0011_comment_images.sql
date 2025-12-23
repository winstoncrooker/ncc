-- Migration 0011: Add images column to forum_comments table
ALTER TABLE forum_comments ADD COLUMN images TEXT;
