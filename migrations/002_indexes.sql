-- Nexus Email Sender Database Schema
-- Migration 002: Performance Indexes

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Contact indexes
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_user_email ON contacts(user_id, email);

-- List indexes
CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);

-- List members indexes
CREATE INDEX IF NOT EXISTS idx_list_members_list_id ON list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_contact_id ON list_members(contact_id);

-- Sender indexes
CREATE INDEX IF NOT EXISTS idx_senders_user_id ON senders(user_id);

-- Template indexes
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

-- Campaign indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Campaign job indexes
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_campaign_id ON campaign_jobs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_contact_id ON campaign_jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_status ON campaign_jobs(status);
CREATE INDEX IF NOT EXISTS idx_campaign_jobs_campaign_status ON campaign_jobs(campaign_id, status);

-- Event indexes
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
