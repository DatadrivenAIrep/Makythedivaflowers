-- db/migrations/030_house_accounts.sql — house accounts (cuentas por cobrar).
--
-- An organization that orders often and pays on a schedule. The ledger
-- (house_account_entries) is the source of truth for what is owed; statements
-- are immutable snapshots of the running balance at a period close; sends are
-- the queue (and the log) of statement/reminder messages the daily cron runs.
CREATE TABLE IF NOT EXISTS house_accounts (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  billing_name       TEXT,
  billing_phone      TEXT,                     -- digits only, like customers.phone
  billing_email      TEXT,
  locale             TEXT NOT NULL DEFAULT 'en',
  cadence            TEXT NOT NULL DEFAULT 'monthly',   -- weekly | biweekly | monthly
  issue_day          INTEGER NOT NULL DEFAULT 1,        -- monthly 1..28; weekly/biweekly weekday 0..6
  anchor_date        TEXT,                              -- biweekly only: first issue date
  terms_days         INTEGER NOT NULL DEFAULT 15,
  reminder_plan_json TEXT NOT NULL DEFAULT '[]',        -- [{"offsetDays":-3,"channel":"sms"}, ...]
  statement_channel  TEXT NOT NULL DEFAULT 'sms',       -- sms | email | both
  status             TEXT NOT NULL DEFAULT 'active',    -- active | paused | closed
  notes              TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

-- A person allowed to charge to the account. UNIQUE(customer_id): one account per person.
CREATE TABLE IF NOT EXISTS house_account_contacts (
  account_id  TEXT NOT NULL REFERENCES house_accounts(id),
  customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id),
  created_at  TEXT NOT NULL,
  PRIMARY KEY (account_id, customer_id)
);

-- The ledger. amount_cents is signed: charge / positive adjustment > 0;
-- payment / credit / reversal / negative adjustment < 0. Balance = SUM(amount_cents).
CREATE TABLE IF NOT EXISTS house_account_entries (
  id                TEXT PRIMARY KEY,
  account_id        TEXT NOT NULL REFERENCES house_accounts(id),
  kind              TEXT NOT NULL,              -- charge | payment | credit | adjustment | reversal
  amount_cents      INTEGER NOT NULL,
  order_id          TEXT,
  statement_id      TEXT,                       -- NULL = not yet on a statement
  method            TEXT,                       -- payments: cash | zelle | ach | check | card-terminal | stripe
  stripe_session_id TEXT UNIQUE,                -- Stripe payments: webhook idempotency key
  note              TEXT,
  actor             TEXT NOT NULL,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hae_account_created ON house_account_entries(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hae_order ON house_account_entries(order_id);
CREATE INDEX IF NOT EXISTS idx_hae_account_statement ON house_account_entries(account_id, statement_id);

CREATE TABLE IF NOT EXISTS house_account_statements (
  id             TEXT PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES house_accounts(id),
  number         TEXT NOT NULL UNIQUE,           -- ST-1001
  code           TEXT NOT NULL UNIQUE,           -- 8-char base62 for /s/<code>
  period_start   TEXT NOT NULL,                  -- YYYY-MM-DD
  period_end     TEXT NOT NULL,                  -- YYYY-MM-DD
  issued_at      TEXT NOT NULL,
  due_date       TEXT NOT NULL,                  -- YYYY-MM-DD
  opening_cents  INTEGER NOT NULL,
  charges_cents  INTEGER NOT NULL,
  credits_cents  INTEGER NOT NULL,
  payments_cents INTEGER NOT NULL,
  closing_cents  INTEGER NOT NULL,               -- running balance at period_end
  settled_cents  INTEGER NOT NULL DEFAULT 0,     -- recomputed from the ledger (lib/house-account-settlement.ts)
  status         TEXT NOT NULL,                  -- open | paid | void
  lines_json     TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
-- One live statement per period; a voided one may be re-issued for the same period.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hst_account_period
  ON house_account_statements(account_id, period_end) WHERE status != 'void';

CREATE TABLE IF NOT EXISTS statement_number_seq (last_value INTEGER NOT NULL);
INSERT INTO statement_number_seq (last_value) VALUES (1000);

-- Queue + log. The cron claims a row (scheduled -> sending) before sending so a
-- double run cannot send twice; the row then becomes sent / failed / skipped.
CREATE TABLE IF NOT EXISTS house_account_sends (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES house_accounts(id),
  statement_id  TEXT NOT NULL REFERENCES house_account_statements(id),
  kind          TEXT NOT NULL,                   -- statement | reminder | manual
  step_index    INTEGER,
  channel       TEXT NOT NULL,                   -- sms | email | both (as requested)
  scheduled_for TEXT NOT NULL,                   -- YYYY-MM-DD
  status        TEXT NOT NULL,                   -- scheduled | sending | sent | skipped | failed | canceled
  claimed_at    TEXT,
  sent_at       TEXT,
  sms_sid       TEXT,
  email_id      TEXT,
  body          TEXT,
  error         TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_has_status_date ON house_account_sends(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_has_statement ON house_account_sends(statement_id);

ALTER TABLE orders ADD COLUMN house_account_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_house_account ON orders(house_account_id);
