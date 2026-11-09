import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { e164 } from "@/lib/twilio-server";
import type { LoyaltyReward } from "@/lib/loyalty-rewards";

// SMS verification of a typed phone number. A shopper only types a phone, so
// nothing about a card's rewards may be spent without proving control of it:
// a 6 digit code by SMS, then a short-lived signed proof the checkout carries.

const CODE_TTL_MS = 10 * 60_000;
const PROOF_TTL_MS = 15 * 60_000;
const MAX_ATTEMPTS = 5;

// Key derived from the API key so the raw key is never used as an HMAC key
// directly, and rotating LOYALTY_API_KEY invalidates every outstanding proof.
function signingKey(): Buffer {
  const base = process.env.LOYALTY_API_KEY;
  if (!base) throw new Error("loyalty_not_configured");
  return createHmac("sha256", base).update("diva-loyalty-proof-v1").digest();
}

function hmac(data: string): Buffer {
  return createHmac("sha256", signingKey()).update(data).digest();
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function hashCode(phone: string, code: string): string {
  return hmac(`code:${phone}:${code}`).toString("hex");
}

/** New 6 digit code for this phone; replaces any earlier one. Only its hash is stored. */
export function createCode(phone: string): string {
  const p = e164(phone);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO loyalty_sms_codes (phone, code_hash, expires_at, attempts)
       VALUES (?, ?, ?, 0)`,
    )
    .run(p, hashCode(p, code), new Date(Date.now() + CODE_TTL_MS).toISOString());
  return code;
}

/** "ok" and the fifth wrong attempt both delete the code, so it can never be retried. */
export function checkCode(phone: string, code: string): "ok" | "wrong" | "expired" {
  const p = e164(phone);
  const db = getDb();
  const row = db
    .prepare("SELECT code_hash, expires_at, attempts FROM loyalty_sms_codes WHERE phone = ?")
    .get(p) as { code_hash: string; expires_at: string; attempts: number } | undefined;
  if (!row) return "expired";

  const drop = () => db.prepare("DELETE FROM loyalty_sms_codes WHERE phone = ?").run(p);
  if (new Date(row.expires_at).getTime() <= Date.now() || row.attempts >= MAX_ATTEMPTS) {
    drop();
    return "expired";
  }

  const given = Buffer.from(hashCode(p, code), "hex");
  if (safeEqual(given, Buffer.from(row.code_hash, "hex"))) {
    drop();
    return "ok";
  }

  if (row.attempts + 1 >= MAX_ATTEMPTS) drop();
  else db.prepare("UPDATE loyalty_sms_codes SET attempts = attempts + 1 WHERE phone = ?").run(p);
  return "wrong";
}

type ProofPayload = { p: string; r: LoyaltyReward[]; exp: number };

/** `base64url(JSON).signature`, valid 15 minutes, bound to one phone. */
export function signProof(phone: string, rewards: LoyaltyReward[], now: Date = new Date()): string {
  const payload: ProofPayload = { p: e164(phone), r: rewards, exp: now.getTime() + PROOF_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(`proof:${body}`).toString("base64url")}`;
}

/** The rewards a proof vouches for, or null if it is forged, expired or for another phone. */
export function readProof(
  token: string,
  phone: string,
  now: Date = new Date(),
): { rewards: LoyaltyReward[] } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    if (!safeEqual(Buffer.from(sig, "base64url"), hmac(`proof:${body}`))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ProofPayload;
    if (typeof payload.exp !== "number" || payload.exp < now.getTime()) return null;
    if (payload.p !== e164(phone) || !Array.isArray(payload.r)) return null;
    return { rewards: payload.r };
  } catch {
    return null;
  }
}
