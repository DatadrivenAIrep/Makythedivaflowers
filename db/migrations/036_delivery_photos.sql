-- Proof-of-delivery photo: at most one per order. The file lives at
-- data/delivery-photos/<token>.jpg; the token is also the public URL key that
-- Twilio fetches for the MMS, so it must be unguessable.
CREATE TABLE IF NOT EXISTS delivery_photos (
  order_id   TEXT PRIMARY KEY REFERENCES orders(id),
  token      TEXT NOT NULL UNIQUE,
  bytes      INTEGER NOT NULL,
  width      INTEGER NOT NULL,
  height     INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Outbound MMS: the media URL sent with the message (null for plain SMS).
ALTER TABLE messages ADD COLUMN media_url TEXT;
