-- Funeral homes the shop delivers to often: picked from the intake in one tap.
CREATE TABLE IF NOT EXISTS funeral_homes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT,
  address_json  TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
