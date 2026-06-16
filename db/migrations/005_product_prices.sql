-- Per-variant price overrides set from the admin dashboard.
-- When a row exists, it takes precedence over the priceCents in data/products.ts.
-- Deleting a row restores the catalog base price automatically.
CREATE TABLE IF NOT EXISTS product_price_overrides (
  product_id  TEXT NOT NULL,
  variant_id  TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents >= 0),
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (product_id, variant_id)
);
