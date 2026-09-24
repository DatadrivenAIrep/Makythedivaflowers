import { z } from "zod";

// Quick-pick denominations for staff; any whole-dollar amount inside the band is
// also accepted so a one-off (e.g. an apology for $35) doesn't need a code change.
export const GIFT_CARD_AMOUNTS = [2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000] as const;
export const ADMIN_GIFT_CARD_MIN_CENTS = 500;
export const ADMIN_GIFT_CARD_MAX_CENTS = 100000;

export const issueGiftCardSchema = z.object({
  amountCents: z
    .number()
    .int()
    .min(ADMIN_GIFT_CARD_MIN_CENTS, "amount_too_small")
    .max(ADMIN_GIFT_CARD_MAX_CENTS, "amount_too_large")
    .refine((n) => n % 100 === 0, { message: "amount_whole_dollars" }),
  recipientEmail: z.string().email("email_invalid"),
  recipientName: z.string().max(80).optional(),
  fromLabel: z.string().max(80).optional(),
  personalMessage: z.string().max(400).optional(),
  reason: z.enum(["loyalty", "apology", "prize", "marketing", "other"]).optional(),
});

export type IssueGiftCardInputDTO = z.infer<typeof issueGiftCardSchema>;
