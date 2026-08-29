// Client-safe SMS-segment estimate. Lives apart from campaign-sender.ts (which is
// `import "server-only"`) so the compose-screen live counter can import it in the
// browser. campaign-sender re-exports this, so the server keeps one source of truth.

// GSM 03.38 basic + extension charset. Anything outside it forces UCS-2.
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà" +
  "^{}\\[~]|€";

/** Estimate SMS segments (GSM-7: 160/153; UCS-2: 70/67). */
export function smsSegments(body: string): number {
  const chars = [...body];
  const gsm7 = chars.every((ch) => GSM7.includes(ch));
  const len = chars.length;
  if (gsm7) return len <= 160 ? 1 : Math.ceil(len / 153);
  return len <= 70 ? 1 : Math.ceil(len / 67);
}
