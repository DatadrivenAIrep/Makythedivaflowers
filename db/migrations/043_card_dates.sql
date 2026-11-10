-- 043_card_dates.sql — birthdays/anniversaries read from order card messages.
-- (customer_important_dates.source already exists since 042; 'card' is a new value.)
ALTER TABLE customer_important_dates ADD COLUMN relationship TEXT;
ALTER TABLE customer_important_dates ADD COLUMN source_order_id TEXT;

CREATE TABLE IF NOT EXISTS card_date_scans (
  order_id   TEXT PRIMARY KEY,
  outcome    TEXT NOT NULL CHECK(outcome IN ('saved','review','duplicate','excluded','none','dismissed')),
  date_id    TEXT,
  scanned_at TEXT NOT NULL
);
