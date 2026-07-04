import { NextResponse } from "next/server";
import { createInquiry, listInquiries } from "@/lib/inquiry-storage-db";
import { stageCounts, openPipelineValueCents } from "@/lib/pipeline";
import { manualInquirySchema } from "@/schemas/inquiry-admin";

export const runtime = "nodejs";

export async function GET(_req: Request): Promise<Response> {
  const inquiries = listInquiries();
  return NextResponse.json({
    inquiries,
    stats: { counts: stageCounts(inquiries), openValueCents: openPipelineValueCents(inquiries) },
  });
}

export async function POST(req: Request): Promise<Response> {
  const json = await req.json().catch(() => null);
  const parsed = manualInquirySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const inquiry = createInquiry({
    type: d.type,
    contactName: d.contact.name,
    contactEmail: d.contact.email,
    contactPhone: d.contact.phone,
    budgetBand: d.budgetBand,
    eventDate: d.eventDate || undefined,
    venue: d.venue,
    guests: d.guests,
    company: d.company,
    frequency: d.frequency,
    notes: d.notes,
    sourceChannel: "manual",
  });
  return NextResponse.json({ inquiry }, { status: 201 });
}
