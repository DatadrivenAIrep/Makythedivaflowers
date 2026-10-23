import { z } from "zod";

/**
 * Optional US mobile for the gift card SMS. Blank means "email only"; anything
 * else must be a full 10-digit number (an optional leading 1 is dropped) so a
 * typo fails at the form instead of as a silent Twilio error after issuing.
 */
export const optionalRecipientPhone = z
  .string()
  .optional()
  .transform((s) => {
    const d = (s ?? "").replace(/\D/g, "");
    return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  })
  .refine((d) => d === "" || d.length === 10, "phone_invalid")
  .transform((d) => d || undefined);
