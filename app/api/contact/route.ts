// app/api/contact/route.ts
import { NextResponse } from "next/server";
import { contactSchema } from "@/schemas/contact";
import { saveInquiry } from "@/lib/inquiry-storage";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`contact:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const id = `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await saveInquiry({
    id,
    type: "contact",
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  });
  const { notifyOwner } = await import("@/lib/notify-owner");
  await notifyOwner(`Nueva consulta: ${parsed.data.name} · ${parsed.data.email} — "${parsed.data.subject}".`);
  // Also enter the pipeline DB so it can be tracked/acknowledged in the radar.
  // Best-effort: the public form must never fail because of the pipeline DB.
  try {
    const { createInquiry } = await import("@/lib/inquiry-storage-db");
    createInquiry({
      id,
      type: "contact",
      contactName: parsed.data.name,
      contactEmail: parsed.data.email,
      contactPhone: "", // the contact form has no phone field
      notes: `${parsed.data.subject}\n\n${parsed.data.body}`,
      sourceChannel: "web",
      locale: parsed.data.locale,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error(JSON.stringify({ event: "contact_sqlite_failed", id, error: String(e) }));
  }
  console.log(`[contact] from ${parsed.data.email}`);
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
