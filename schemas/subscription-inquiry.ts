import { z } from "zod";
import { occasionSchema, relationSchema } from "@/schemas/card-message";

const phone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().min(10, "phone_too_short").max(15));

const zip = z.string().regex(/^\d{5}(-\d{4})?$/, "zip_invalid");

const startDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date_invalid")
  .refine((s) => {
    const d = new Date(s + "T00:00:00");
    const min = new Date();
    min.setHours(0, 0, 0, 0);
    min.setDate(min.getDate() + 2);
    return d.getTime() >= min.getTime();
  }, "date_too_soon");

export const subscriptionInquirySchema = z.object({
  type: z.literal("subscription"),
  locale: z.enum(["en", "es"]),
  plan: z.enum(["petit", "maison", "atelier"]),
  cadence: z.enum(["weekly", "biweekly"]),
  startDate,
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
    slot: z.enum(["morning", "midday", "afternoon", "evening"]),
  }),
  contact: z.object({
    email: z.string().email("email_invalid"),
    phone,
  }),
  cardMessageMode: z.enum(["fixed", "rotation"]).default("fixed"),
  cardMessage: z.string().max(500, "card_too_long").optional().or(z.literal("")),
  cardOccasion: z
    .union([occasionSchema, z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  cardRelation: z
    .union([relationSchema, z.literal("")])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  notes: z.string().max(1000, "notes_too_long").optional().or(z.literal("")),
  honeypot: z.string().max(0),
}).refine(
  (data) => data.cardMessageMode !== "rotation" || (data.cardOccasion && data.cardRelation),
  { message: "rotation_requires_occasion_relation", path: ["cardOccasion"] },
);

export type SubscriptionInquiry = z.infer<typeof subscriptionInquirySchema>;
export type SubscriptionInquiryInput = z.input<typeof subscriptionInquirySchema>;
