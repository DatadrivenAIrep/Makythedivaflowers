import type { Occasion } from "@/schemas/card-message";
import { occasionSchema } from "@/schemas/card-message";

const VALID = new Set<string>(occasionSchema.options);

export function parseCampaign(raw: string | string[] | undefined): Occasion | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  return VALID.has(value) ? (value as Occasion) : undefined;
}
