// schemas/inquiry.ts
import { z } from "zod";

const baseContact = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().transform((s) => s.replace(/\D/g, "")).pipe(z.string().min(10).max(15)),
});

const honeypot = z.string().max(0);
const budgetBand = z.enum(["5-10k", "10-25k", "25k+", "open"]);

const baseShared = {
  contact: baseContact,
  budgetBand,
  vibe: z.string().min(10).max(2000),
  locale: z.enum(["en", "es"]),
  honeypot,
};

export const weddingInquirySchema = z.object({
  type: z.literal("wedding"),
  ...baseShared,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  venue: z.string().max(120).optional().or(z.literal("")),
  guests: z.coerce.number().int().min(1).max(2000).optional(),
  source: z.string().max(60).optional().or(z.literal("")),
});

export const eventInquirySchema = z.object({
  type: z.literal("event"),
  ...baseShared,
  company: z.string().min(2).max(120),
  frequency: z.enum(["one-time", "weekly", "biweekly", "monthly", "quarterly"]),
  guests: z.coerce.number().int().min(1).max(2000).optional(),
});

export type WeddingInquiry = z.infer<typeof weddingInquirySchema>;
export type EventInquiry = z.infer<typeof eventInquirySchema>;
