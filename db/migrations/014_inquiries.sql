-- 014_inquiries.sql — weddings/events sales pipeline.
CREATE TABLE IF NOT EXISTS inquiries (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL,
  stage           TEXT NOT NULL,
  contact_name    TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  contact_phone   TEXT NOT NULL,
  budget_band     TEXT,
  event_date      TEXT,
  venue           TEXT,
  guests          INTEGER,
  company         TEXT,
  frequency       TEXT,
  vibe            TEXT,
  notes           TEXT,
  follow_up_date  TEXT,
  lost_reason     TEXT,
  source_channel  TEXT NOT NULL,
  locale          TEXT,
  acknowledged_at TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inquiries_stage ON inquiries(stage);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_changes (
  id          TEXT PRIMARY KEY,
  inquiry_id  TEXT NOT NULL,
  at          TEXT NOT NULL,
  actor       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  summary     TEXT NOT NULL,
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id)
);
CREATE INDEX IF NOT EXISTS idx_inquiry_changes_inquiry ON inquiry_changes(inquiry_id, at);
