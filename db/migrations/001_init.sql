CREATE TABLE IF NOT EXISTS orders (
  id                       TEXT PRIMARY KEY,
  locale                   TEXT NOT NULL,
  source                   TEXT NOT NULL,
  customer_id              TEXT,
  recipient_name           TEXT NOT NULL,
  recipient_phone          TEXT NOT NULL,
  contact_email            TEXT,
  contact_phone            TEXT NOT NULL,
  fulfillment_method       TEXT NOT NULL,
  address_json             TEXT,
  window_date              TEXT,
  window_slot              TEXT,
  card_message             TEXT,
  lines_json               TEXT NOT NULL,
  subtotal_cents           INTEGER NOT NULL,
  delivery_cents           INTEGER NOT NULL,
  tax_cents                INTEGER NOT NULL,
  total_cents              INTEGER NOT NULL,
  fulfillment_status       TEXT NOT NULL,
  payment_status           TEXT NOT NULL,
  payment_method           TEXT,
  paid_at                  TEXT,
  stripe_payment_intent_id TEXT,
  taken_by                 TEXT,
  internal_notes           TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_window_date ON orders(window_date);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_pi ON orders(stripe_payment_intent_id);

CREATE TABLE IF NOT EXISTS customers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL UNIQUE,
  email             TEXT,
  last_address_json TEXT,
  order_count       INTEGER NOT NULL DEFAULT 0,
  first_seen_at     TEXT NOT NULL,
  last_seen_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS print_jobs (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL,
  status      TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  printed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_order  ON print_jobs(order_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TEXT NOT NULL
);
