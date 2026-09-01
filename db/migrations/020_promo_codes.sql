-- 020_promo_codes.sql — promotional discount codes.
--
-- Distinct from gift_cards: a gift card is stored value the buyer already paid
-- for and draws down; a promo code is a discount the shop grants, so it has no
-- balance, and its limits are "how many times" and "for whom" instead.
--
-- promo_redemptions is the audit ledger AND the redemption counter: the count of
-- rows is the source of truth, so a UNIQUE(promo_id, order_id) makes a retried
-- webhook idempotent at the database level rather than in application code.
CREATE TABLE IF NOT EXISTS promo_codes (
  id                 TEXT PRIMARY KEY,
  code               TEXT NOT NULL UNIQUE,      -- canonical: uppercase, trimmed
  kind               TEXT NOT NULL,             -- 'percent' | 'fixed' | 'free_delivery'
  value              INTEGER NOT NULL,          -- percent: 1..100 · fixed: cents · free_delivery: unused
  min_subtotal_cents INTEGER,                   -- null = no minimum
  max_redemptions    INTEGER,                   -- null = unlimited
  first_order_only   INTEGER NOT NULL DEFAULT 0,
  active             INTEGER NOT NULL DEFAULT 1,
  starts_at          TEXT,                      -- ISO; null = live immediately
  ends_at            TEXT,                      -- ISO; null = no expiry
  note               TEXT,                      -- internal: what this code is for
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id            TEXT PRIMARY KEY,
  promo_id      TEXT NOT NULL REFERENCES promo_codes(id),
  order_id      TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL,               -- discount actually granted
  created_at    TEXT NOT NULL,
  UNIQUE(promo_id, order_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON promo_redemptions(promo_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_order ON promo_redemptions(order_id);

-- Order columns: which code was used and what it took off. Both null for orders
-- placed without a code.
ALTER TABLE orders ADD COLUMN promo_id TEXT;
ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN discount_cents INTEGER;
