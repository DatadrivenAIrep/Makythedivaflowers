// app/api/newsletter/route.ts
import { NextResponse } from "next/server";
import { newsletterSchema } from "@/schemas/newsletter";
import { saveInquiry } from "@/lib/inquiry-storage";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`newsletter:${ip}`, { max: 3, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = newsletterSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const id = `nl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await saveInquiry({
    id,
    type: "newsletter",
    payload: { email: parsed.data.email },
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  });
  console.log(`[newsletter] ${parsed.data.email}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
