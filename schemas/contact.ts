// schemas/contact.ts
import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  subject: z.string().min(2).max(120),
  body: z.string().min(10).max(2000),
  locale: z.enum(["en", "es"]),
  honeypot: z.string().max(0),
});

export type ContactInput = z.infer<typeof contactSchema>;
