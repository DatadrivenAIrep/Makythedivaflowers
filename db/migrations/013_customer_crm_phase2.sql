-- 013_customer_crm_phase2.sql — CRM Phase 2: important dates + structured preferences.
CREATE TABLE IF NOT EXISTS customer_important_dates (
  id           TEXT PRIMARY KEY,
  customer_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,
  label        TEXT,
  month        INTEGER NOT NULL,
  day          INTEGER NOT NULL,
  year         INTEGER,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_important_dates_customer ON customer_important_dates(customer_id);
CREATE INDEX IF NOT EXISTS idx_important_dates_month_day ON customer_important_dates(month, day);

CREATE TABLE IF NOT EXISTS customer_preferences (
  customer_id  TEXT NOT NULL,
  kind         TEXT NOT NULL,
  value        TEXT NOT NULL,
  PRIMARY KEY (customer_id, kind, value)
);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_kind_value ON customer_preferences(kind, value);
CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer ON customer_preferences(customer_id);
