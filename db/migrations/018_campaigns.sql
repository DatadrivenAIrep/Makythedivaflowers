-- 018_campaigns.sql — marketing SMS campaigns, separate from the order-scoped
-- `messages` table. `campaigns` is one composed promotion; `campaign_sends` is
-- one row per recipient attempt (audit + idempotency).
CREATE TABLE IF NOT EXISTS campaigns (
  id              TEXT PRIMARY KEY,
  body_es         TEXT NOT NULL,
  body_en         TEXT NOT NULL DEFAULT '',
  segment         TEXT NOT NULL DEFAULT 'sms-marketing',
  status          TEXT NOT NULL DEFAULT 'draft',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count      INTEGER NOT NULL DEFAULT 0,
  failed_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  sent_at         TEXT
);

CREATE TABLE IF NOT EXISTS campaign_sends (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL,
  customer_id  TEXT NOT NULL,
  phone        TEXT NOT NULL,
  status       TEXT NOT NULL,
  provider_sid TEXT,
  error        TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON campaign_sends(campaign_id);
