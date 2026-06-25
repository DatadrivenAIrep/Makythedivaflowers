import { z } from "zod";

const phone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().min(10, "phone_too_short").max(15));

const zip = z.string().regex(/^\d{5}(-\d{4})?$/, "zip_invalid");

const address = z.object({
  street1: z.string().min(3).max(120),
  street2: z.string().max(120).optional().or(z.literal("")),
  city: z.string().min(2).max(80),
  state: z.string().length(2),
  zip,
  country: z.literal("US"),
});

const window = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid"),
  slot: z.enum(["morning", "midday", "afternoon", "evening"]),
});

const recipient = z.object({ name: z.string().min(2).max(80), phone });

const deliveryF = z.object({
  method: z.literal("delivery"),
  recipient,
  address,
  window,
  cardMessage: z.string().max(200).optional(),
});
const pickupF = z.object({
  method: z.literal("pickup"),
  recipient,
  window,
  cardMessage: z.string().max(200).optional(),
});
const inStoreF = z.object({
  method: z.literal("in-store"),
  recipient,
  cardMessage: z.string().max(200).optional(),
});

const catalogLine = z.object({
  kind: z.literal("catalog"),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  addOnIds: z.array(z.string()),
  qty: z.number().int().min(1).max(99),
});
const customLine = z.object({
  kind: z.literal("custom"),
  title: z.string().min(2).max(120),
  priceCents: z.number().int().min(0).max(1_000_000),
  designerNotes: z.string().max(400).optional(),
  qty: z.number().int().min(1).max(99),
});

const payment = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("paid"),
    method: z.enum(["cash", "zelle", "card-terminal", "ach", "stripe"]),
  }),
  z.object({ status: z.literal("pending") }),
]);

export const intakeSchema = z.object({
  source: z.enum(["walk-in", "phone", "whatsapp", "event"]),
  customer: z.object({
    phone,
    name: z.string().min(2).max(80),
    email: z.string().email().optional().or(z.literal("")),
    messagingChannel: z.enum(["sms", "whatsapp", "email", "none"]).optional(),
    locale: z.enum(["en", "es"]).optional(),
    buyerAddress: address.optional(),
  }),
  fulfillment: z.discriminatedUnion("method", [deliveryF, pickupF, inStoreF]),
  lines: z.array(z.discriminatedUnion("kind", [catalogLine, customLine])).min(1),
  totalsOverride: z
    .object({
      subtotalCents: z.number().int().min(0).optional(),
      deliveryCents: z.number().int().min(0).optional(),
      taxCents: z.number().int().min(0).optional(),
      totalCents: z.number().int().min(0).optional(),
    })
    .optional(),
  internalNotes: z.string().max(400).optional(),
  giftCardCode: z.string().min(1).max(50).optional(),
  payment,
});

export type IntakeInput = z.infer<typeof intakeSchema>;
