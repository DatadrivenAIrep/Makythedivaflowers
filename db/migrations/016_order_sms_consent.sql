-- 016_order_sms_consent.sql — records whether the buyer opted in to automated
-- SMS (order updates + marketing) at web checkout. 0 = no consent (default).
ALTER TABLE orders ADD COLUMN sms_consent INTEGER NOT NULL DEFAULT 0;
