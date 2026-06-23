-- Gift cards: store-issued courtesy cards with stored-value (draw-down) balance.
-- balance_cents on the row is the source of truth; gift_card_redemptions is the audit ledger.
CREATE TABLE IF NOT EXISTS gift_cards (
  id               TEXT PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,        -- canonical form WITH dashes, uppercase: e.g. DIVA-7K2M-9XQ4
  initial_cents    INTEGER NOT NULL CHECK(initial_cents > 0),
  balance_cents    INTEGER NOT NULL CHECK(balance_cents >= 0),
  status           TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'void'
  recipient_email  TEXT NOT NULL,
  recipient_name   TEXT,
  from_label       TEXT,
  personal_message TEXT,
  reason           TEXT,                         -- loyalty | apology | prize | marketing | other
  issued_by        TEXT,
  expires_at       TEXT,                         -- ISO; issuance + 1 year
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id            TEXT PRIMARY KEY,
  gift_card_id  TEXT NOT NULL REFERENCES gift_cards(id),
  order_id      TEXT,
  amount_cents  INTEGER NOT NULL,               -- positive = redeem (debit), negative = refund (credit)
  type          TEXT NOT NULL,                   -- 'redeem' | 'refund'
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gcr_card ON gift_card_redemptions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gcr_order ON gift_card_redemptions(order_id);

-- Order columns used in Milestone B (harmless to add now).
ALTER TABLE orders ADD COLUMN gift_card_id TEXT;
ALTER TABLE orders ADD COLUMN gift_card_cents INTEGER;
