-- 037_tax_exempt.sql — sales-tax exemption on customers and house accounts,
-- and a per-order snapshot (flag + certificate) so history never changes.
ALTER TABLE customers ADD COLUMN tax_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN tax_exempt_cert TEXT;
ALTER TABLE customers ADD COLUMN tax_exempt_expires TEXT;
ALTER TABLE house_accounts ADD COLUMN tax_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE house_accounts ADD COLUMN tax_exempt_cert TEXT;
ALTER TABLE house_accounts ADD COLUMN tax_exempt_expires TEXT;
ALTER TABLE orders ADD COLUMN tax_exempt INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN tax_exempt_cert TEXT;
