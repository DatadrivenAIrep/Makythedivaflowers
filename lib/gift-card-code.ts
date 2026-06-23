// Crockford-ish alphabet: no 0/O/1/I/L so codes are easy to read aloud and type.
export const GIFT_CARD_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomGroup(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * GIFT_CARD_ALPHABET.length);
    out += GIFT_CARD_ALPHABET[idx];
  }
  return out;
}

/** Generates a canonical code like DIVA-7K2M-9XQ4. Uniqueness is enforced by the caller (DB UNIQUE + retry). */
export function generateGiftCardCode(): string {
  return `DIVA-${randomGroup(4)}-${randomGroup(4)}`;
}

/**
 * Normalizes user-typed input to the canonical stored form.
 * "diva 7k2m 9xq4" / "DIVA7K2M9XQ4" → "DIVA-7K2M-9XQ4".
 * Non-matching input is just uppercased/trimmed (lookup will miss → invalid code).
 */
export function normalizeCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  const m = cleaned.match(/^DIVA([0-9A-Z]{4})([0-9A-Z]{4})$/);
  if (m) return `DIVA-${m[1]}-${m[2]}`;
  return input.trim().toUpperCase();
}
