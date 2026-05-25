-- 003_dashboard.sql
CREATE TABLE IF NOT EXISTS order_acknowledgments (
  order_id          TEXT PRIMARY KEY,
  acknowledged_at   TEXT NOT NULL,
  acknowledged_by   TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);
