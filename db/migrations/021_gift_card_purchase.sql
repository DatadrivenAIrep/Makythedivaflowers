-- 021_gift_card_purchase.sql — gift cards bought by customers on the site.
--
-- Until now every card was issued by staff from the admin. A public purchase is
-- paid first and issued second, which needs a way to tell "this payment already
-- produced a card" — otherwise a replayed Stripe webhook issues a second one.
-- The unique index is that guarantee, enforced by the database rather than by
-- application code.
ALTER TABLE gift_cards ADD COLUMN purchase_payment_intent_id TEXT;
ALTER TABLE gift_cards ADD COLUMN purchaser_email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_purchase_pi
  ON gift_cards(purchase_payment_intent_id)
  WHERE purchase_payment_intent_id IS NOT NULL;
