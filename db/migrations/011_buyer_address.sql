-- The buyer's own address (distinct from last_address_json, which is the last
-- delivery/recipient destination). Captured at intake, reused on return.
ALTER TABLE customers ADD COLUMN buyer_address_json TEXT;
