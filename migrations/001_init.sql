-- Nexus Email Sender Database Schema
-- Migration 001: Initial Schema

-- ============================================
-- CORE: Organizations, Users, Sessions
-- ============================================

CREATE TABLE IF NOT EXISTS orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_orgs_created ON orgs(created_at);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'MEMBER', -- OWNER, ADMIN, MEMBER, READONLY
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- CRM: Contacts, Lists, Relationships
-- ============================================

CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    title TEXT,
    phone TEXT,
    tags_json TEXT DEFAULT '[]',
    custom_json TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(org_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC);

CREATE TABLE IF NOT EXISTS lists (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lists_org ON lists(org_id);

CREATE TABLE IF NOT EXISTS list_members (
    list_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (list_id, contact_id),
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_list_members_contact ON list_members(contact_id);

-- ============================================
-- SENDING ACCOUNTS: Inboxes and Health
-- ============================================

CREATE TABLE IF NOT EXISTS inboxes (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    provider TEXT NOT NULL, -- google, microsoft
    email TEXT NOT NULL,
    display_name TEXT,
    oauth_json_encrypted TEXT NOT NULL, -- encrypted OAuth tokens
    status TEXT NOT NULL DEFAULT 'active', -- active, disconnected, paused
    daily_limit INTEGER NOT NULL DEFAULT 500,
    per_hour_limit INTEGER NOT NULL DEFAULT 50,
    min_delay_sec INTEGER NOT NULL DEFAULT 60,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inboxes_org ON inboxes(org_id);
CREATE INDEX IF NOT EXISTS idx_inboxes_status ON inboxes(org_id, status);

CREATE TABLE IF NOT EXISTS inbox_health (
    id TEXT PRIMARY KEY,
    inbox_id TEXT NOT NULL,
    metric TEXT NOT NULL, -- sent_today, sent_this_hour, last_sent_at, bounce_rate
    value TEXT NOT NULL,
    ts INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (inbox_id) REFERENCES inboxes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inbox_health_inbox ON inbox_health(inbox_id, metric);
CREATE INDEX IF NOT EXISTS idx_inbox_health_ts ON inbox_health(ts DESC);

-- ============================================
-- CAMPAIGNS: Sequences, Steps, Enrollments
-- ============================================

CREATE TABLE IF NOT EXISTS sequences (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sequences_org ON sequences(org_id);
CREATE INDEX IF NOT EXISTS idx_sequences_status ON sequences(org_id, status);

CREATE TABLE IF NOT EXISTS sequence_steps (
    id TEXT PRIMARY KEY,
    sequence_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'email', -- email, delay, linkedin, sms
    subject TEXT,
    html TEXT,
    text TEXT,
    wait_days INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_seq ON sequence_steps(sequence_id, step_index);

CREATE TABLE IF NOT EXISTS enrollments (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    sequence_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, active, paused, completed, unsubscribed, bounced
    current_step INTEGER NOT NULL DEFAULT 0,
    next_run_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    completed_at INTEGER,
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrollments_org ON enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_seq ON enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_next_run ON enrollments(org_id, next_run_at) WHERE next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(org_id, status);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    enrollment_id TEXT NOT NULL,
    inbox_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued', -- queued, sending, sent, delivered, bounced, failed, opened, clicked, replied
    provider_message_id TEXT,
    subject TEXT,
    to_email TEXT NOT NULL,
    sent_at INTEGER,
    delivered_at INTEGER,
    opened_at INTEGER,
    clicked_at INTEGER,
    replied_at INTEGER,
    bounced_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
    FOREIGN KEY (inbox_id) REFERENCES inboxes(id) ON DELETE SET NULL,
    FOREIGN KEY (step_id) REFERENCES sequence_steps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_enrollment ON messages(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_messages_inbox ON messages(inbox_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(org_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- ============================================
-- TRACKING: Links, Events
-- ============================================

CREATE TABLE IF NOT EXISTS tracking_links (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    message_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tracking_links_code ON tracking_links(code);
CREATE INDEX IF NOT EXISTS idx_tracking_links_message ON tracking_links(message_id);

CREATE TABLE IF NOT EXISTS tracking_events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    type TEXT NOT NULL, -- open, click, bounce, reply, unsubscribe
    message_id TEXT,
    tracking_link_id TEXT,
    ts INTEGER NOT NULL DEFAULT (unixepoch()),
    ip_hash TEXT,
    user_agent TEXT,
    meta_json TEXT DEFAULT '{}',
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (tracking_link_id) REFERENCES tracking_links(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_org ON tracking_events(org_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_message ON tracking_events(message_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON tracking_events(org_id, type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_ts ON tracking_events(ts DESC);

-- ============================================
-- COMPLIANCE: Unsubscribes, Suppression, Domains
-- ============================================

CREATE TABLE IF NOT EXISTS unsubscribes (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_unsubscribes_org_email ON unsubscribes(org_id, email);

CREATE TABLE IF NOT EXISTS suppression (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    email TEXT NOT NULL,
    type TEXT NOT NULL, -- bounce, complaint, manual
    reason TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_suppression_org_email ON suppression(org_id, email);

CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    dkim_status TEXT DEFAULT 'pending', -- pending, verified, failed
    spf_status TEXT DEFAULT 'pending',
    dmarc_status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_domains_org ON domains(org_id);

-- ============================================
-- PIXEL: Sites and Events
-- ============================================

CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    name TEXT NOT NULL,
    allowed_domains_json TEXT NOT NULL DEFAULT '[]', -- array of allowed domains
    pixel_secret TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sites_org ON sites(org_id);

CREATE TABLE IF NOT EXISTS pixel_events (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL,
    ts INTEGER NOT NULL DEFAULT (unixepoch()),
    event_type TEXT NOT NULL DEFAULT 'pageview', -- pageview, event
    url TEXT NOT NULL,
    referrer TEXT,
    anon_id TEXT NOT NULL, -- anonymous visitor ID
    ip_hash TEXT NOT NULL, -- hashed IP for privacy
    country TEXT,
    city TEXT,
    ua TEXT, -- user agent
    meta_json TEXT DEFAULT '{}',
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pixel_events_site ON pixel_events(site_id);
CREATE INDEX IF NOT EXISTS idx_pixel_events_ts ON pixel_events(site_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_pixel_events_anon ON pixel_events(site_id, anon_id);

-- ============================================
-- EVENTS: Audit Log
-- ============================================

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    user_id TEXT,
    type TEXT NOT NULL, -- auth.login, contact.created, sequence.started, message.sent, etc.
    entity_type TEXT, -- contact, sequence, message, etc.
    entity_id TEXT,
    payload_json TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_org ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(org_id, type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);

-- ============================================
-- Initial seed data (optional)
-- ============================================

-- Note: Initial user creation should be done via signup endpoint
-- to ensure proper password hashing
