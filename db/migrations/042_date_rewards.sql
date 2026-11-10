-- 042_date_rewards.sql — loyalty stamps for saving important dates and flower likes.
ALTER TABLE customer_important_dates ADD COLUMN source TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE customers ADD COLUMN sms_stopped_at TEXT;

CREATE TABLE IF NOT EXISTS date_preferences (
  date_id TEXT NOT NULL,
  kind    TEXT NOT NULL CHECK(kind IN ('favorite_flower','favorite_color','avoid')),
  value   TEXT NOT NULL,
  PRIMARY KEY (date_id, kind, value)
);
CREATE TABLE IF NOT EXISTS date_prompt_answers (
  order_id   TEXT PRIMARY KEY,
  answer     TEXT NOT NULL CHECK(answer IN ('date','likes','dismiss')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS loyalty_bonus (
  customer_id TEXT NOT NULL,
  slot        TEXT NOT NULL CHECK(slot IN ('fecha','gustos')),
  status      TEXT NOT NULL CHECK(status IN ('pending','done','failed')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (customer_id, slot)
);
CREATE TABLE IF NOT EXISTS marketing_consent_log (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL,
  action       TEXT NOT NULL CHECK(action IN ('grant','revoke')),
  source       TEXT NOT NULL CHECK(source IN ('date_prompt','account')),
  ip           TEXT,
  text_version TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE TABLE date_reminder_sends_new (
  date_id         TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  stage           TEXT NOT NULL CHECK(stage IN ('d7','d3')),
  status          TEXT NOT NULL CHECK(status IN ('sent','skipped')),
  skip_reason     TEXT,
  recorded_at     TEXT NOT NULL,
  PRIMARY KEY (date_id, occurrence_date, stage)
);
INSERT INTO date_reminder_sends_new (date_id, occurrence_date, stage, status, recorded_at)
  SELECT date_id, occurrence_date, 'd7', 'sent', sent_at FROM date_reminder_sends;
DROP TABLE date_reminder_sends;
ALTER TABLE date_reminder_sends_new RENAME TO date_reminder_sends;
