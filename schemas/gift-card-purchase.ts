import { z } from "zod";

/**
 * Denominations the shop sells online, plus a custom amount inside a band.
 *
 * The band exists in both directions: too small and the delivery fee makes the
 * card useless, too large and a stolen card is a real loss. Staff can still
 * issue any amount from the admin.
 */
export const GIFT_CARD_PRESET_CENTS = [5000, 10000, 15000, 25000] as const;
export const GIFT_CARD_MIN_CENTS = 2500;
export const GIFT_CARD_MAX_CENTS = 50000;

export const giftCardPurchaseSchema = z.object({
  locale: z.enum(["en", "es"]),
  amountCents: z
    .number()
    .int()
    .min(GIFT_CARD_MIN_CENTS, "amount_too_small")
    .max(GIFT_CARD_MAX_CENTS, "amount_too_large"),
  recipientEmail: z.string().email("email_invalid"),
  recipientName: z.string().max(80).optional().or(z.literal("")),
  fromLabel: z.string().max(80).optional().or(z.literal("")),
  personalMessage: z.string().max(400).optional().or(z.literal("")),
  purchaserEmail: z.string().email("email_invalid"),
});

export type GiftCardPurchaseInput = z.infer<typeof giftCardPurchaseSchema>;
