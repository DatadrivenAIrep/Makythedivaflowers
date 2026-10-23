import crypto from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const CODE_LENGTH = 8;
export const CODE_PATTERN = /^[0-9A-Za-z]{8}$/;

// 62^8 ≈ 2·10^14 codes. Bytes >= 248 (= 62 * 4) are skipped so every
// character is equally likely. Shared by digital cards (/c/<code>) and
// house-account statements (/s/<code>).
export function generateCode(random: (n: number) => Buffer = crypto.randomBytes): string {
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of random(16)) {
      if (b >= 248) continue;
      out += ALPHABET[b % 62];
      if (out.length === CODE_LENGTH) break;
    }
  }
  return out;
}
