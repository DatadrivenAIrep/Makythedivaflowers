-- 027_gift_card_headline.sql — optional custom headline for the gift card email.
--
-- The email greets the recipient with "{name}, someone sent you flowers", which
-- reads oddly when the card goes to an organization (e.g. a charity partner).
-- When set, this replaces that line verbatim. NULL keeps the default greeting.
ALTER TABLE gift_cards ADD COLUMN headline TEXT;
