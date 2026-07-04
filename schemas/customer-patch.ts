import { z } from "zod";

export const customerPatchSchema = z
  .object({
    notes: z.string().max(4000).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().or(z.literal("")).optional(),
    messagingChannel: z.enum(["sms", "whatsapp", "email", "none"]).optional(),
    locale: z.enum(["en", "es"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "empty_patch" });

export type CustomerPatchInput = z.infer<typeof customerPatchSchema>;

export const tagBodySchema = z.object({ tag: z.string().min(1).max(64) });
