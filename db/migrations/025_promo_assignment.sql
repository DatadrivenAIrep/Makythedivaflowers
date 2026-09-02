-- 025_promo_assignment.sql — codes that belong to one person.
--
-- The welcome offer, the referral reward and the loyalty reward are all texted
-- to a specific customer. Without an owner, a forwarded screenshot turns any of
-- them into a public discount, so a code may be bound to the phone it was sent
-- to. referrer_customer_id is the other half of a referral: who gets credited
-- once the code is actually used on a paid order.
ALTER TABLE promo_codes ADD COLUMN assigned_phone TEXT;
ALTER TABLE promo_codes ADD COLUMN referrer_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_promo_codes_referrer ON promo_codes(referrer_customer_id);
