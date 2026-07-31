import { z } from "zod";

/**
 * Lax on purpose: a draft is an in-progress order and may be incomplete/invalid.
 * We only bound the top-level shape and total size — the intake schema is applied
 * later, at real create time.
 */
const draftPayloadSchema = z
  .object({
    version: z.literal(1),
    channel: z.enum(["walk-in", "phone", "whatsapp", "event"]),
    customer: z.record(z.string(), z.unknown()),
    fulfillment: z.record(z.string(), z.unknown()),
    lines: z.array(z.unknown()).max(200).default([]),
    override: z.record(z.string(), z.unknown()).optional(),
    giftCardCode: z.string().max(50_000).optional(),
    payment: z.record(z.string(), z.unknown()),
  })
  .passthrough();

const MAX_PAYLOAD_BYTES = 50_000;

export const draftRequestSchema = z
  .object({
    payload: draftPayloadSchema,
    label: z.string().max(120).default(""),
    itemCount: z.number().int().min(0).max(999).default(0),
    totalCents: z.number().int().min(0).max(100_000_000).default(0),
  })
  .refine((d) => JSON.stringify(d.payload).length <= MAX_PAYLOAD_BYTES, {
    message: "payload_too_large",
    path: ["payload"],
  });

export type DraftRequest = z.infer<typeof draftRequestSchema>;
