import { NextResponse } from "next/server";
import { getCustomerById } from "@/lib/customer-storage";
import { addImportantDate, removeImportantDate } from "@/lib/customer-dates-storage";
import { isValidMonthDay } from "@/lib/customer-dates";
import { dateDeleteSchema, importantDateSchema } from "@/schemas/customer-dates";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = importantDateSchema.safeParse(json);
  if (!parsed.success || !isValidMonthDay(parsed.data.month, parsed.data.day)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  return NextResponse.json({ dates: addImportantDate(id, parsed.data) });
}

export async function DELETE(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!getCustomerById(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const json = await req.json().catch(() => null);
  const parsed = dateDeleteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  return NextResponse.json({ dates: removeImportantDate(id, parsed.data.id) });
}
