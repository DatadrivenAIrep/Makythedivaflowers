-- 019_sms_inbox.sql — the per-customer SMS inbox: capture inbound replies, and
-- store the rendered outbound body so the conversation shows the real text.
CREATE TABLE IF NOT EXISTS inbound_messages (
  id           TEXT PRIMARY KEY,
  from_phone   TEXT NOT NULL,
  customer_id  TEXT,
  body         TEXT NOT NULL,
  provider_sid TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbound_from ON inbound_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_inbound_customer ON inbound_messages(customer_id);

ALTER TABLE messages ADD COLUMN body TEXT;
