-- 017_order_sms_marketing_consent.sql — records whether the buyer opted in to
-- MARKETING/promotional SMS, captured separately from the transactional
-- (order/delivery) consent in sms_consent. 0 = no marketing consent (default).
ALTER TABLE orders ADD COLUMN sms_marketing_consent INTEGER NOT NULL DEFAULT 0;
