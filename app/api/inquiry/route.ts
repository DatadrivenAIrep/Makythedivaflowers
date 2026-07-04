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
  return NextResponse.json({ ok: true, id }, { status: 200 });
}
