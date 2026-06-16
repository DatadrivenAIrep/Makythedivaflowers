-- Generic key/value settings store for admin-configurable options.
-- Values are stored as JSON strings so any scalar type fits in one table.
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
