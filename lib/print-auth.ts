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
    // Run a constant-time compare on dummy buffers so the response time
    // does not betray the length mismatch.
    timingSafeEqual(Buffer.alloc(b.length), b);
    return false;
  }
  return timingSafeEqual(a, b);
}
