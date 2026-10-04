-- 031_order_funeral.sql — the order is for a funeral.
--
-- Funeral homes keep only the message card (the third panel) and discard the rest,
-- so a funeral order prints that panel in a sober design that carries the Maky
-- brand and contact. 0 = a regular order, as before.
ALTER TABLE orders ADD COLUMN funeral INTEGER NOT NULL DEFAULT 0;
