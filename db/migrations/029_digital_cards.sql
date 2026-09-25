-- 029_digital_cards.sql — a digital greeting card attached to an order.
--
-- The printed card cover carries a QR to /c/<code>, which redirects to
-- target_url (a card on tarjetas.makythedivaflowers.com) or shows a
-- "being prepared" page while target_url is NULL. One card per order.
CREATE TABLE digital_cards (
  order_id   TEXT PRIMARY KEY REFERENCES orders(id),
  code       TEXT NOT NULL UNIQUE,
  target_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
