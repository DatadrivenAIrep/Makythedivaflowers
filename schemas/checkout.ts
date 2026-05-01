// schemas/checkout.ts
import { z } from "zod";

const phone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().min(10, "phone_too_short").max(15));

const zip = z.string().regex(/^\d{5}(-\d{4})?$/, "zip_invalid");

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid")
  .refine((s) => {
    const d = new Date(s + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  }, "date_in_past");

export const checkoutSchema = z.object({
  contact: z.object({
    email: z.string().email("email_invalid"),
    phone,
  }),
  delivery: z.object({
    recipient: z.object({
      name: z.string().min(2, "name_too_short").max(80),
      phone,
    }),
    address: z.object({
      street1: z.string().min(3, "street_required").max(120),
      street2: z.string().max(120).optional().or(z.literal("")),
      city: z.string().min(2, "city_required").max(80),
      state: z.string().length(2, "state_invalid"),
      zip,
      country: z.literal("US"),
    }),
    window: z.object({
      date,
      slot: z.enum(["morning", "midday", "afternoon", "evening"]),
    }),
    cardMessage: z.string().max(200, "card_too_long").optional().or(z.literal("")),
  }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
