import { z } from "zod";

export const importantDateSchema = z.object({
  kind: z.enum(["birthday", "anniversary", "custom"]),
  label: z.string().trim().max(60).optional(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  year: z.number().int().min(1900).max(2100).optional(),
});
export type ImportantDateBody = z.infer<typeof importantDateSchema>;

export const dateDeleteSchema = z.object({ id: z.string().min(1) });

export const preferenceBodySchema = z.object({
  kind: z.enum(["favorite_flower", "favorite_color", "dislike"]),
  value: z.string().min(1).max(64),
});
