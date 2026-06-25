-- Immutable audit log of every change an order goes through.
CREATE TABLE IF NOT EXISTS order_changes (
  id           TEXT PRIMARY KEY,
  order_id     TEXT NOT NULL,
  at           TEXT NOT NULL,            -- ISO timestamp
  actor        TEXT NOT NULL,            -- admin session user; "maky" for now
  kind         TEXT NOT NULL,            -- created | edit | payment | fulfillment | cancel | note | reprint
  summary      TEXT NOT NULL,            -- human-readable one-liner (Spanish)
  changes_json TEXT                      -- JSON array of field diffs for kind='edit'; NULL otherwise
);
CREATE INDEX IF NOT EXISTS idx_order_changes_order ON order_changes(order_id, at);

-- How much has actually been collected, for balance (saldo) computation.
ALTER TABLE orders ADD COLUMN amount_paid_cents INTEGER NOT NULL DEFAULT 0;

-- Backfill: existing fully-paid orders are considered paid in full.
UPDATE orders SET amount_paid_cents = total_cents WHERE payment_status = 'paid';
