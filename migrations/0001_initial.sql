-- Migration: 0001_initial.sql
-- Create the urls table with url and likes columns

CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    likes INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index on url for faster lookups
CREATE INDEX IF NOT EXISTS idx_urls_url ON urls(url);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_urls_updated_at 
    AFTER UPDATE ON urls
    FOR EACH ROW
    BEGIN
        UPDATE urls SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;