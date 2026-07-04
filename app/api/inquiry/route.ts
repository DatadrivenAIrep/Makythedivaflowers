import { NextResponse } from "next/server";
import { z } from "zod";
import { weddingInquirySchema, eventInquirySchema } from "@/schemas/inquiry";
import { subscriptionInquirySchema } from "@/schemas/subscription-inquiry";
import { saveInquiry, type InquiryRecord } from "@/lib/inquiry-storage";
import { notifyInquiry } from "@/lib/notify-inquiry";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

const requestSchema = z.discriminatedUnion("type", [
  weddingInquirySchema,
  eventInquirySchema,
  subscriptionInquirySchema,
]);

export async function POST(req: Request) {
  const ip = ipFromRequest(req);
  const rl = rateLimit(`inquiry:${ip}`, { max: 5, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, errors: { formErrors: ["rate_limited"] } }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: parsed.error.flatten() }, { status: 400 });
  }
  const id = `iq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record: InquiryRecord = {
    id,
    type: parsed.data.type,
    payload: parsed.data,
    createdAt: new Date().toISOString(),
    ip,
    locale: parsed.data.locale,
  };
  await saveInquiry(record);
  await notifyInquiry(record); // best-effort; never throws
  console.log(`[inquiry] ${parsed.data.type} from ${parsed.data.contact.email}`);
  if (parsed.data.type === "wedding" || parsed.data.type === "event") {
    try {
      const { createInquiry } = await import("@/lib/inquiry-storage-db");
      const c = parsed.data.contact;
      createInquiry({
        id: record.id,
        type: parsed.data.type,
        contactName: c.name,
        contactEmail: c.email,
        contactPhone: c.phone,
        budgetBand: parsed.data.budgetBand,
        eventDate: "date" in parsed.data ? parsed.data.date || undefined : undefined,
        venue: "venue" in parsed.data ? parsed.data.venue || undefined : undefined,
        guests: "guests" in parsed.data ? parsed.data.guests : undefined,
        company: "company" in parsed.data ? parsed.data.company : undefined,
        frequency: "frequency" in parsed.data ? parsed.data.frequency : undefined,
        vibe: parsed.data.vibe,
        sourceChannel: "web",
        locale: parsed.data.locale,
        createdAt: record.createdAt,
      });
    } catch (e) {
      // Best-effort: the public form must never fail because of the pipeline DB.
      console.error(JSON.stringify({ event: "inquiry_sqlite_failed", id: record.id, error: String(e) }));
    }
  }
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
