CREATE TABLE IF NOT EXISTS product_image_overrides (
  product_id TEXT PRIMARY KEY,
  src        TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
