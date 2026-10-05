-- 033_gift_card_phone.sql — optional recipient mobile for the gift card SMS.
--
-- When set, the card is texted to the recipient alongside the email. NULL keeps
-- the email-only delivery every earlier card had.
ALTER TABLE gift_cards ADD COLUMN recipient_phone TEXT;
