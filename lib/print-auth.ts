// lib/print-auth.ts
import { timingSafeEqual } from "node:crypto";

export function isPrintAuthValid(header: string | null | undefined): boolean {
  const expected = process.env.PRINT_AGENT_TOKEN;
  if (!expected) return false;
  if (!header || !header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
