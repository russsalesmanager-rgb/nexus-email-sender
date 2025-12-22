-- Nexus Email Sender - Initial Schema
-- This migration creates all tables for a multi-tenant outreach SaaS

-- Organizations (Multi-tenant base)
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_orgs_created ON orgs(created_at);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'READONLY')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  tags_json TEXT DEFAULT '[]',
  custom_json TEXT DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_contacts_org ON contacts(org_id);
CREATE INDEX idx_contacts_email ON contacts(org_id, email);
CREATE INDEX idx_contacts_created ON contacts(created_at);

-- Lists
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_lists_org ON lists(org_id);

-- List Members (many-to-many)
CREATE TABLE IF NOT EXISTS list_members (
  list_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  PRIMARY KEY (list_id, contact_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX idx_list_members_list ON list_members(list_id);
CREATE INDEX idx_list_members_contact ON list_members(contact_id);

-- Inboxes (Email sending accounts)
CREATE TABLE IF NOT EXISTS inboxes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mailchannels', 'gmail', 'microsoft')),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  oauth_json_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  daily_limit INTEGER NOT NULL DEFAULT 500,
  per_hour_limit INTEGER NOT NULL DEFAULT 50,
  min_delay_sec INTEGER NOT NULL DEFAULT 60,
  sent_today INTEGER NOT NULL DEFAULT 0,
  last_send_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_inboxes_org ON inboxes(org_id);
CREATE INDEX idx_inboxes_status ON inboxes(org_id, status);

-- Sequences (Email campaigns)
CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_sequences_org ON sequences(org_id);
CREATE INDEX idx_sequences_status ON sequences(org_id, status);

-- Sequence Steps
CREATE TABLE IF NOT EXISTS sequence_steps (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT,
  wait_days INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE
);

CREATE INDEX idx_steps_sequence ON sequence_steps(sequence_id, step_index);

-- Enrollments (Contact in sequence)
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'bounced', 'unsubscribed')),
  current_step INTEGER NOT NULL DEFAULT 0,
  next_run_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
  FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX idx_enrollments_org ON enrollments(org_id);
CREATE INDEX idx_enrollments_sequence ON enrollments(sequence_id);
CREATE INDEX idx_enrollments_contact ON enrollments(contact_id);
CREATE INDEX idx_enrollments_next_run ON enrollments(next_run_at) WHERE status = 'active';
CREATE INDEX idx_enrollments_status ON enrollments(org_id, status);

-- Messages (Email sent/scheduled)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  inbox_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'bounced', 'failed', 'opened', 'clicked')),
  provider_message_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  sent_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  FOREIGN KEY (inbox_id) REFERENCES inboxes(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES sequence_steps(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_org ON messages(org_id);
CREATE INDEX idx_messages_enrollment ON messages(enrollment_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_sent ON messages(sent_at);

-- Unsubscribes
CREATE TABLE IF NOT EXISTS unsubscribes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_unsubscribes_org ON unsubscribes(org_id);
CREATE INDEX idx_unsubscribes_email ON unsubscribes(org_id, email);

-- Suppression List (bounces, complaints, etc.)
CREATE TABLE IF NOT EXISTS suppression (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bounce', 'complaint', 'manual')),
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_suppression_org ON suppression(org_id);
CREATE INDEX idx_suppression_email ON suppression(org_id, email);

-- Events (Audit log)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_events_org ON events(org_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created ON events(created_at);

-- Website Visitor Tracking: Sites
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  allowed_domains_json TEXT NOT NULL,
  pixel_secret TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

CREATE INDEX idx_sites_org ON sites(org_id);

-- Website Visitor Tracking: Pixel Events
CREATE TABLE IF NOT EXISTS pixel_events (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'pageview',
  url TEXT NOT NULL,
  referrer TEXT,
  anon_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  country TEXT,
  city TEXT,
  ua TEXT,
  meta_json TEXT DEFAULT '{}',
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE INDEX idx_pixel_events_site ON pixel_events(site_id);
CREATE INDEX idx_pixel_events_ts ON pixel_events(site_id, ts);
CREATE INDEX idx_pixel_events_anon ON pixel_events(anon_id);
