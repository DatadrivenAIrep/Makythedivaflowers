-- 022_date_reminder_sends.sql — ledger of important-date reminders already sent.
--
-- The reminder job is driven by an external cron, which may fire more than once
-- a day (retries, a second host, a manual run). One row per date per occurrence,
-- with the uniqueness enforced by the database, is what stops a customer being
-- texted twice about the same birthday — and lets the same date fire again next
-- year, because the occurrence date is part of the key.
CREATE TABLE IF NOT EXISTS date_reminder_sends (
  date_id         TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,   -- YYYY-MM-DD of the occurrence, not of the send
  sent_at         TEXT NOT NULL,
  PRIMARY KEY (date_id, occurrence_date)
);
