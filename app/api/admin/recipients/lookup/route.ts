import { NextResponse } from "next/server";
import { recipientProfile } from "@/lib/recipient-history";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }
  const recipient = recipientProfile(phone);
  return NextResponse.json(recipient ? { found: true, recipient } : { found: false });
}
