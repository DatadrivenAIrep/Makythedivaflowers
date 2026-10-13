import { z } from "zod";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Exemption on a customer or a house account, as edited in the panel. */
export const taxExemptionInput = z
  .object({
    exempt: z.boolean(),
    cert: z.string().max(60).nullable().optional(),
    expires: ymd.or(z.literal("")).nullable().optional(),
  })
  .refine((v) => !v.exempt || !!v.cert?.trim(), { message: "tax_exempt_cert_required", path: ["cert"] });

/** Per-order request from intake / order edit. */
export const taxExemptRequest = z.object({
  taxExempt: z.boolean(),
  cert: z.string().max(60).optional(),
});
