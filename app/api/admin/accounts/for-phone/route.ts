import { NextResponse } from "next/server";
import { findAccountForPhone } from "@/lib/house-account-storage";
export const runtime = "nodejs";
export async function GET(req: Request): Promise<Response> {
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  const a = phone.replace(/\D/g, "").length >= 10 ? findAccountForPhone(phone) : null;
  return NextResponse.json({ account: a ? { id: a.id, name: a.name } : null });
}
