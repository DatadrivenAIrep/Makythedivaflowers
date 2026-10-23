import { generateCode } from "@/lib/short-code";
export { CODE_LENGTH, CODE_PATTERN } from "@/lib/short-code";

// Kept under its old name so existing callers and tests do not change.
export const generateCardCode = generateCode;

export function shortUrl(code: string): string {
  // `||` (not `??`) so an empty env var still falls back to the shop domain.
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://makythedivaflowers.com").replace(/\/+$/, "");
  return `${base}/c/${code}`;
}
