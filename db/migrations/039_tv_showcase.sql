-- Maky's per-product choice for the shop TV (/vitrina). No row = default
-- (everything but sympathy shows). A table of its own so the migration stays
-- idempotent under next build's parallel workers.
CREATE TABLE IF NOT EXISTS tv_showcase_visibility (
  product_id TEXT PRIMARY KEY,
  visible    INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
