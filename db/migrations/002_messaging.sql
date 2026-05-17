ALTER TABLE customers ADD COLUMN messaging_channel TEXT;
ALTER TABLE customers ADD COLUMN locale TEXT;

ALTER TABLE orders ADD COLUMN stripe_checkout_session_id TEXT;

CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL,
  customer_id  TEXT,
  channel      TEXT NOT NULL,
  template     TEXT NOT NULL,
  locale       TEXT NOT NULL,
  to_phone     TEXT,
  to_email     TEXT,
  provider_sid TEXT,
  status       TEXT NOT NULL,
  error        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
