-- 028_gift_card_partner.sql — optional co-brand partner for the gift card email.
--
-- Key into data/gift-card-partners.ts (e.g. 'the-shelter-connection'); the email
-- then shows that partner's logo under the Diva banner. NULL = Diva-only, as before.
ALTER TABLE gift_cards ADD COLUMN partner TEXT;
