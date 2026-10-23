-- Important dates can belong to one of the customer's recipients (whose phone
-- lets the profile and the intake match them), and suggested dates the shop
-- turned down are remembered so they are not offered again.
ALTER TABLE customer_important_dates ADD COLUMN recipient_phone TEXT;

CREATE TABLE IF NOT EXISTS date_suggestion_dismissals (
  customer_id     TEXT NOT NULL,
  suggestion_key  TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  PRIMARY KEY (customer_id, suggestion_key)
);
