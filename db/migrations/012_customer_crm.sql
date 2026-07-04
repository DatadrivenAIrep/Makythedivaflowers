-- 012_customer_crm.sql — CRM Phase 1: free-text notes + tags on customers.
ALTER TABLE customers ADD COLUMN notes TEXT;

CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id TEXT NOT NULL,
  tag         TEXT NOT NULL,
  PRIMARY KEY (customer_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_customer_tags_tag ON customer_tags(tag);
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer ON customer_tags(customer_id);
