import { z } from "zod";

const contact = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().min(10).max(15)),
});
const budgetBand = z.enum(["5-10k", "10-25k", "25k+", "open"]);

export const manualInquirySchema = z.object({
  type: z.enum(["wedding", "event"]),
  contact,
  budgetBand: budgetBand.optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  venue: z.string().max(120).optional(),
  guests: z.coerce.number().int().min(1).max(2000).optional(),
  company: z.string().max(120).optional(),
  frequency: z.enum(["one-time", "weekly", "biweekly", "monthly", "quarterly"]).optional(),
  notes: z.string().max(4000).optional(),
});
export type ManualInquiryInput = z.infer<typeof manualInquirySchema>;

export const inquiryPatchSchema = z
  .object({
    stage: z.enum(["nuevo", "contactado", "propuesta", "reservado", "completado", "perdido"]).optional(),
    notes: z.string().max(4000).optional(),
    followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
    lost: z.object({ reason: z.string().max(200) }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty_patch" })
  // "lost" is terminal; combining it with a stage change is contradictory
  // (would leave a lost_reason on a non-lost inquiry). Reject the ambiguous request.
  .refine((v) => !(v.lost && v.stage), { message: "lost_and_stage" });
