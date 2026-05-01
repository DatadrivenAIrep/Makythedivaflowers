import { z } from "zod";

export const occasionSchema = z.enum([
  "birthday",
  "anniversary",
  "sympathy",
  "romance",
  "congrats",
  "just-because",
]);

export const relationSchema = z.enum([
  // default mode
  "partner",
  "mother",
  "father",
  "friend",
  "family",
  "other",
  // sympathy mode (overlaps "family" and "other" intentionally)
  "close-friend",
  "coworker",
]);

export const cardMessageRequestSchema = z.object({
  productTitle: z.string().min(1).max(80),
  occasion: occasionSchema,
  relation: relationSchema,
  locale: z.enum(["en", "es"]),
});

export type CardMessageRequest = z.infer<typeof cardMessageRequestSchema>;
export type Occasion = z.infer<typeof occasionSchema>;
export type Relation = z.infer<typeof relationSchema>;
