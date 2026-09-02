import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkLoginCode,
  signCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_TTL_SECONDS,
} from "@/lib/customer-auth";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().min(10).max(15)),
  code: z.string().regex(/^\d{6}$/, "code_invalid"),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const { phone, code } = parsed.data;

  // The stored code locks itself after five wrong guesses; this stops a script
  // cycling through fresh codes to keep guessing.
  const limit = rateLimit(`account-verify:${phone}:${ipFromRequest(req)}`, {
    max: 10,
    windowMs: 15 * 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const result = checkLoginCode(phone, code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_SESSION_COOKIE, signCustomerSession(result.customerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_SESSION_TTL_SECONDS,
  });
  return res;
}
