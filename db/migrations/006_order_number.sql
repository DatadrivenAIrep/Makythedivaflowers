-- Short, human-friendly sequential order number (e.g. #1001) shown on the
-- work sheet, the customer confirmation page, and the shop email. The long
-- internal `id` stays the primary key (used in URLs, Stripe, print jobs).
ALTER TABLE orders ADD COLUMN order_number INTEGER;

-- Single-row counter holding the LAST assigned number. Seeded at 1000 so the
-- first order gets 1001. Incremented atomically in lib/order-storage.ts.
CREATE TABLE IF NOT EXISTS order_number_seq (last_value INTEGER NOT NULL);
INSERT INTO order_number_seq (last_value) VALUES (1000);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
