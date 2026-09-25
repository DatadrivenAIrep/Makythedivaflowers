import { z } from "zod";

// Hosts the /c/<code> redirect may point to. Keeps the short link from being
// an open redirect: a pasted URL on any other host is rejected.
export const DEFAULT_DIGITAL_CARD_HOSTS = ["tarjetas.makythedivaflowers.com"];

export function allowedDigitalCardHosts(): string[] {
  const hosts = (process.env.DIGITAL_CARD_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return hosts.length > 0 ? hosts : DEFAULT_DIGITAL_CARD_HOSTS;
}

export function isAllowedCardUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && allowedDigitalCardHosts().includes(url.hostname.toLowerCase());
}

export const digitalCardPatchSchema = z.object({
  targetUrl: z
    .string()
    .trim()
    .refine(isAllowedCardUrl, "invalid_card_url")
    .transform((v) => new URL(v).href)
    .nullable(),
});
