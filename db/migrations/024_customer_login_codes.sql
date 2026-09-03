-- 024_customer_login_codes.sql — one-time codes for customer sign-in by SMS.
--
-- Password-less on purpose: the shop already has the customer's phone, and a
-- florist's customers will not remember a password they use twice a year.
--
-- The code is stored hashed, never in the clear, so a database copy does not
-- hand over live sign-in codes. One row per phone — requesting a new code
-- replaces the old one, which is also what invalidates it.
CREATE TABLE IF NOT EXISTS customer_login_codes (
  phone       TEXT PRIMARY KEY,   -- digits only
  customer_id TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
