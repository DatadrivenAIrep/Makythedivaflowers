-- Loyalty card (external API): reward chosen on an order, SMS verification codes
-- and the queue of notices that still have to reach the loyalty program.
ALTER TABLE orders ADD COLUMN loyalty_reward_id TEXT;
ALTER TABLE orders ADD COLUMN loyalty_reward_label TEXT;
ALTER TABLE orders ADD COLUMN loyalty_reward_percent INTEGER;
ALTER TABLE orders ADD COLUMN loyalty_join INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS loyalty_sms_codes (
  phone      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS loyalty_sync (
  order_id         TEXT NOT NULL,
  kind             TEXT NOT NULL CHECK(kind IN ('sync','reverse')),
  loyalty_order_id TEXT NOT NULL,
  status           TEXT NOT NULL CHECK(status IN ('pending','done','noop','failed','canceled')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  PRIMARY KEY(order_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_loyalty_sync_status ON loyalty_sync(status);
