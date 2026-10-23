-- Public invoice links: one unguessable code per order, created the first time
-- the invoice is sent to the customer. /i/<code> serves the invoice without an
-- admin session. A table of its own (not a column on orders) so the migration
-- stays idempotent under next build's parallel workers.
CREATE TABLE IF NOT EXISTS invoice_links (
  order_id   TEXT PRIMARY KEY,
  code       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
