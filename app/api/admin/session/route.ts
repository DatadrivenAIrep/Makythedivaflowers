import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPassword, signSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/admin-auth";

export const runtime = "nodejs";

const body = z.object({ password: z.string().min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }
  if (!checkPassword(parsed.data.password)) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }
  const token = signSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}

export async function DELETE() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
