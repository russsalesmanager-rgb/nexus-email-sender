-- Migration 0001: Initial Schema
-- Creates core tables for Nexus Email Sender

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_users_email ON users(email);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    tags_json TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);

-- Lists table
CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_lists_user_id ON lists(user_id);

-- List members (many-to-many relationship)
CREATE TABLE IF NOT EXISTS list_members (
    list_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (list_id, contact_id),
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX idx_list_members_list_id ON list_members(list_id);
CREATE INDEX idx_list_members_contact_id ON list_members(contact_id);
