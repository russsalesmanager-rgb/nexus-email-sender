-- Migration 0004: Events and Audit Log
-- Creates events table for activity logging and auditing

-- Events table (audit log)
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
