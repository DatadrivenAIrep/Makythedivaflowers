import "server-only";
import crypto from "node:crypto";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.INTAKE_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("INTAKE_SESSION_SECRET missing or too short (need ≥ 32 chars)");
  }
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}

export type SessionPayload = { iat: number; exp: number };

export function signSession(opts: { ttlSeconds?: number } = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (opts.ttlSeconds ?? DEFAULT_TTL_SECONDS);
  const payload: SessionPayload = { iat: now, exp };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const mac = crypto.createHmac("sha256", getSecret()).update(body).digest();
  return `${body}.${b64url(mac)}`;
}

export function verifySession(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let expectedMac: Buffer;
  try {
    expectedMac = crypto.createHmac("sha256", getSecret()).update(body).digest();
  } catch {
    return false;
  }
  let providedMac: Buffer;
  try {
    providedMac = fromB64url(sig);
  } catch {
    return false;
  }
  if (providedMac.length !== expectedMac.length) return false;
  if (!crypto.timingSafeEqual(providedMac, expectedMac)) return false;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8")) as SessionPayload;
  } catch {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
}

export function checkPassword(input: string): boolean {
  const expected = process.env.INTAKE_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const SESSION_COOKIE = "intake_session";
export const SESSION_TTL_SECONDS = DEFAULT_TTL_SECONDS;

/** Reads the intake_session cookie from the raw request header (works in route
 * handlers AND in unit tests that call handlers directly). */
export function getSessionTokenFromRequest(req: Request): string {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)intake_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export function requireAdmin(req: Request): boolean {
  return verifySession(getSessionTokenFromRequest(req));
}
