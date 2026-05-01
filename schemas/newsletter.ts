// schemas/newsletter.ts
import { z } from "zod";

export const newsletterSchema = z.object({
  email: z.string().email(),
  locale: z.enum(["en", "es"]),
  honeypot: z.string().max(0),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
