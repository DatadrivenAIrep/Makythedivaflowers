-- 023_order_tip.sql — optional tip for the studio and the driver.
--
-- Stored separately from the sale because it is not revenue: it is collected on
-- the team's behalf, sits outside the taxable base, and the ledger needs to be
-- able to tell the two apart when paying it out.
ALTER TABLE orders ADD COLUMN tip_cents INTEGER;
