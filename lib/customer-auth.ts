import "server-only";
import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

/**
 * Password-less sign-in for customers.
 *
 * A florist's customers order twice a year; a password is something they would
 * reset every time. The shop already knows their phone number, so a code by SMS
 * is both easier and a stronger proof than a password they would reuse.
 *
 * Three properties this file exists to guarantee:
 *   - a customer session can never be mistaken for an admin session
 *   - a stolen database does not hand over live sign-in codes
 *   - guessing a six-digit code is not worth attempting
 */

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const CODE_TTL_MINUTES = 10;
export const MAX_CODE_ATTEMPTS = 5;
export const CUSTOMER_SESSION_COOKIE = "diva_customer";
export const CUSTOMER_SESSION_TTL_SECONDS = DEFAULT_TTL_SECONDS;

function rootSecret(): string {
  const secret = process.env.INTAKE_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("INTAKE_SESSION_SECRET missing or too short (need ≥ 32 chars)");
  }
  return secret;
}

/**
 * A key derived from the shared secret, separated by purpose.
 *
 * Without this, a customer session signed with the raw secret would verify as an
 * admin session — the admin verifier only checks the signature and the expiry.
 * Domain separation is what makes the two token families non-interchangeable.
 */
function keyFor(purpose: "session" | "code"): Buffer {
  return crypto.createHmac("sha256", rootSecret()).update(`diva-customer-${purpose}-v1`).digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}

type CustomerSessionPayload = { sub: string; iat: number; exp: number };

export function signCustomerSession(
  customerId: string,
  opts: { ttlSeconds?: number } = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: CustomerSessionPayload = {
    sub: customerId,
    iat: now,
    exp: now + (opts.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = crypto.createHmac("sha256", keyFor("session")).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

/** The customer id this token proves, or null if it proves nothing. */
export function verifyCustomerSession(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expected: Buffer;
  try {
    expected = crypto.createHmac("sha256", keyFor("session")).update(body).digest();
  } catch {
    return null;
  }
  let provided: Buffer;
  try {
    provided = fromB64url(sig);
  } catch {
    return null;
  }
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;

  let payload: CustomerSessionPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as CustomerSessionPayload;
  } catch {
    return null;
  }
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
  return payload.sub;
}

export function getCustomerTokenFromRequest(req: Request): string {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${CUSTOMER_SESSION_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export function currentCustomerId(req: Request): string | null {
  return verifyCustomerSession(getCustomerTokenFromRequest(req));
}

function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function hashCode(phone: string, code: string): string {
  // Keyed and bound to the phone, so a hash lifted from the table cannot be
  // replayed against a different number.
  return crypto.createHmac("sha256", keyFor("code")).update(`${digits(phone)}:${code}`).digest("hex");
}

export type IssuedCode = { code: string; customerId: string };

/**
 * Create a code for a phone that belongs to a known customer.
 *
 * Returns null for an unknown number — the caller must still answer the request
 * identically either way, so the endpoint does not become a way to ask whether
 * someone shops here.
 */
export function issueLoginCode(
  phone: string,
  opts: { ttlMinutes?: number } = {},
): IssuedCode | null {
  runMigrations();
  const d = digits(phone);
  if (d.length < 10) return null;

  const db = getDb();
  // Match on the last ten digits: numbers are stored as typed, with and without
  // a country code.
  const row = db
    .prepare(
      `SELECT id FROM customers
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')','') LIKE ?
        LIMIT 1`,
    )
    .get(`%${d.slice(-10)}`) as { id: string } | undefined;
  if (!row) return null;

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = new Date(Date.now() + (opts.ttlMinutes ?? CODE_TTL_MINUTES) * 60_000);

  db.prepare(
    `INSERT INTO customer_login_codes (phone, customer_id, code_hash, expires_at, attempts, created_at)
     VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT(phone) DO UPDATE SET
       customer_id = excluded.customer_id,
       code_hash   = excluded.code_hash,
       expires_at  = excluded.expires_at,
       attempts    = 0,
       created_at  = excluded.created_at`,
  ).run(d, row.id, hashCode(d, code), expires.toISOString(), new Date().toISOString());

  return { code, customerId: row.id };
}

export type CodeCheck =
  | { ok: true; customerId: string }
  | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

export function checkLoginCode(phone: string, code: string): CodeCheck {
  runMigrations();
  const d = digits(phone);
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM customer_login_codes WHERE phone = ?")
    .get(d) as
    | { phone: string; customer_id: string; code_hash: string; expires_at: string; attempts: number }
    | undefined;
  if (!row) return { ok: false, reason: "invalid" };

  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  if (Date.parse(row.expires_at) < Date.now()) return { ok: false, reason: "expired" };

  const provided = Buffer.from(hashCode(d, code), "hex");
  const expected = Buffer.from(row.code_hash, "hex");
  const matches =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected);

  if (!matches) {
    db.prepare("UPDATE customer_login_codes SET attempts = attempts + 1 WHERE phone = ?").run(d);
    return { ok: false, reason: "invalid" };
  }

  // Single use: consume it so a code read over someone's shoulder is dead.
  db.prepare("DELETE FROM customer_login_codes WHERE phone = ?").run(d);
  return { ok: true, customerId: row.customer_id };
}
