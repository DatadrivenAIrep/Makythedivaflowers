-- Buyer's name on the order. Captured at intake (the person who placed the
-- order, who may differ from the gift's recipient) and shown in the work
-- sheet's "Buyer" block so the shop knows who to call about the order.
-- Denormalized onto the order like recipient_name/contact_phone — the order
-- stays self-contained for offline print rendering. Web checkout doesn't
-- collect a buyer name, so this is nullable.
ALTER TABLE orders ADD COLUMN contact_name TEXT;
