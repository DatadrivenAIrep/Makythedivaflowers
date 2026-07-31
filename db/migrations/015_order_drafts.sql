-- 015_order_drafts.sql — in-progress intake orders saved for later resume.
-- payload_json holds the raw IntakeForm state (DraftPayload), not a validated Order,
-- so incomplete orders can be saved and restored exactly.
CREATE TABLE IF NOT EXISTS order_drafts (
  id           TEXT PRIMARY KEY,
  label        TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL,
  item_count   INTEGER NOT NULL DEFAULT 0,
  total_cents  INTEGER NOT NULL DEFAULT 0,
  taken_by     TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_drafts_updated_at ON order_drafts(updated_at DESC);
