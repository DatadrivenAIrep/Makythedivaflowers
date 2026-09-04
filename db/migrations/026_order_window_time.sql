-- 026_order_window_time.sql — optional exact requested delivery/pickup time.
--
-- The intake used to capture only a broad slot (morning/midday/afternoon/evening).
-- Now it can also capture a precise "HH:MM" time; the slot is derived from it so the
-- run sheet and TV board keep bucketing. NULL means a flexible slot, as before.
ALTER TABLE orders ADD COLUMN window_time TEXT;
