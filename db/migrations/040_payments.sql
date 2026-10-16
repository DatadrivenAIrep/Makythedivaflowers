-- Every money event, one row each (see docs/superpowers/specs/2026-10-16-cierre-del-dia-design.md).
CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY,
  at                TEXT NOT NULL,             -- ISO UTC
  day               TEXT NOT NULL,             -- shop-local YYYY-MM-DD
  kind              TEXT NOT NULL,             -- payment | deposit | balance | refund | gift_card_sale
  method            TEXT NOT NULL,             -- cash | zelle | card-terminal | ach | check | stripe | gift-card | unknown
  amount_cents      INTEGER NOT NULL,          -- negative for refunds
  order_id          TEXT,
  house_account_id  TEXT,
  gift_card_id      TEXT,
  source            TEXT NOT NULL,
  actor             TEXT NOT NULL,
  note              TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_day_method ON payments(day, method);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- One saved cash-up per shop day.
CREATE TABLE IF NOT EXISTS cash_closes (
  day                  TEXT PRIMARY KEY,
  opening_float_cents  INTEGER NOT NULL,
  cash_in_cents        INTEGER NOT NULL,
  cash_refunds_cents   INTEGER NOT NULL,
  cash_out_cents       INTEGER NOT NULL,
  cash_out_note        TEXT,
  expected_cents       INTEGER NOT NULL,
  counted_cents        INTEGER NOT NULL,
  difference_cents     INTEGER NOT NULL,
  float_left_cents     INTEGER NOT NULL,
  reviewed_json        TEXT NOT NULL,
  totals_json          TEXT NOT NULL,
  note                 TEXT,
  actor                TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
