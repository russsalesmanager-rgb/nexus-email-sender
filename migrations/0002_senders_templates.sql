-- Migration 0002: Senders and Templates
-- Creates tables for email senders and templates

-- Senders table (email sender identities)
CREATE TABLE IF NOT EXISTS senders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    from_name TEXT NOT NULL,
    from_email TEXT NOT NULL,
    reply_to TEXT,
    provider TEXT NOT NULL DEFAULT 'mailchannels',
    provider_config_json_encrypted TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_senders_user_id ON senders(user_id);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    html TEXT NOT NULL,
    text TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_templates_user_id ON templates(user_id);
