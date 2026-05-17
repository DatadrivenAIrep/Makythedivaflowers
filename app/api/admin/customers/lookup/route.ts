import { NextResponse } from "next/server";
import { getByPhone } from "@/lib/customer-storage";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }
  const customer = getByPhone(phone);
  if (!customer) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, customer });
}
