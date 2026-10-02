import { z } from "zod";

export const reminderStep = z.object({
  offsetDays: z.number().int().min(-60).max(120),
  channel: z.enum(["sms", "email", "both"]),
});

export const accountBody = z.object({
  name: z.string().trim().min(1).max(120),
  billingName: z.string().max(120).optional(),
  billingPhone: z.string().max(25).optional(),
  billingEmail: z.string().email().optional().or(z.literal("")),
  locale: z.enum(["en", "es"]).optional(),
  cadence: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  issueDay: z.number().int().min(0).max(28).optional(),
  termsDays: z.number().int().min(0).max(120).optional(),
  reminderPlan: z.array(reminderStep).max(10).optional(),
  statementChannel: z.enum(["sms", "email", "both"]).optional(),
  notes: z.string().max(1000).optional(),
});
export type AccountBody = z.infer<typeof accountBody>;

export const accountPatch = accountBody.partial().extend({
  status: z.enum(["active", "paused", "closed"]).optional(),
});
export type AccountPatchBody = z.infer<typeof accountPatch>;

export const paymentBody = z.object({
  amountCents: z.number().int().positive(),
  method: z.enum(["cash", "zelle", "ach", "check", "card-terminal"]),
  note: z.string().max(500).optional(),
});

export const entryBody = z.object({
  kind: z.enum(["credit", "adjustment"]),
  amountCents: z.number().int(),
  note: z.string().trim().min(1).max(500),
});

export const contactBody = z.object({ customerId: z.string().min(1) });
export const sendBody = z.object({ channel: z.enum(["sms", "email", "both"]) });
export const sendPatch = z.union([
  z.object({ skip: z.literal(true) }),
  z.object({ scheduledFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ sendNow: z.literal(true) }),
]);
