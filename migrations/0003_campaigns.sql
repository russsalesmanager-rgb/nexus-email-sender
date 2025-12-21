-- Migration 0003: Campaigns
-- Creates tables for campaigns and campaign jobs

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    list_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES senders(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

-- Campaign jobs table (tracks individual sends)
CREATE TABLE IF NOT EXISTS campaign_jobs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    provider_message_id TEXT,
    sent_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX idx_campaign_jobs_campaign_id ON campaign_jobs(campaign_id);
CREATE INDEX idx_campaign_jobs_contact_id ON campaign_jobs(contact_id);
CREATE INDEX idx_campaign_jobs_status ON campaign_jobs(status);
