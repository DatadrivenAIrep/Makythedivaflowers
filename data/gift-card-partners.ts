/**
 * Organizations a gift card can be co-branded with. The email shows the
 * partner's logo under the Diva banner ("In partnership with …").
 *
 * A fixed registry rather than a free-text logo URL: the email embeds the image
 * from our own domain, so a partner is added by dropping its logo in
 * public/partners/ and listing it here.
 */
export const GIFT_CARD_PARTNERS = {
  "the-shelter-connection": {
    name: "The Shelter Connection",
    logo: "/partners/the-shelter-connection.png",
    // Rendered size in the email; the source PNG is 817x361.
    width: 190,
    height: 84,
  },
} as const;

export type GiftCardPartnerId = keyof typeof GIFT_CARD_PARTNERS;

export const GIFT_CARD_PARTNER_IDS = Object.keys(GIFT_CARD_PARTNERS) as [
  GiftCardPartnerId,
  ...GiftCardPartnerId[],
];
