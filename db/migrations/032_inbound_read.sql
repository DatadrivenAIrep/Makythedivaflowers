-- 032_inbound_read.sql — unread state for customer SMS replies, so the admin
-- panel (dashboard, TV, Mensajes tab) can alert on new ones. Everything that
-- arrived before this migration counts as read: the shop shouldn't be rung for
-- history on day one.
ALTER TABLE inbound_messages ADD COLUMN read_at TEXT;
UPDATE inbound_messages SET read_at = created_at WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inbound_unread ON inbound_messages(read_at);
