import { z } from "zod";

// Phase 1 ships a single denomination. Add more to this literal union to enable them.
export const GIFT_CARD_AMOUNTS = [15000] as const;

export const issueGiftCardSchema = z.object({
  amountCents: z
    .number()
    .int()
    .refine((n) => (GIFT_CARD_AMOUNTS as readonly number[]).includes(n), {
      message: "amount_not_allowed",
    }),
  recipientEmail: z.string().email("email_invalid"),
  recipientName: z.string().max(80).optional(),
  fromLabel: z.string().max(80).optional(),
  personalMessage: z.string().max(400).optional(),
  reason: z.enum(["loyalty", "apology", "prize", "marketing", "other"]).optional(),
});

export type IssueGiftCardInputDTO = z.infer<typeof issueGiftCardSchema>;
