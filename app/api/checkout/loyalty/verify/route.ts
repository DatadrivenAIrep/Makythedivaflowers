import { NextResponse } from "next/server";
import { z } from "zod";
import { loyaltyEnabled, lookupCustomer } from "@/lib/loyalty-client";
import { applicableRewards } from "@/lib/loyalty-rewards";
import { checkCode, signProof } from "@/lib/loyalty-proof";
import { e164 } from "@/lib/twilio-server";

export const runtime = "nodejs";

const schema = z.object({
  phone: z.string().regex(/^[+\d\s().-]{7,20}$/),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ reason: "wrong" }, { status: 400 });
  const phone = e164(parsed.data.phone);

  const unavailable = NextResponse.json({ reason: "unavailable" }, { status: 503 });
  if (!loyaltyEnabled()) return unavailable;

  const result = checkCode(phone, parsed.data.code);
  if (result !== "ok") return NextResponse.json({ reason: result }, { status: 400 });

  // The proof lists the rewards as they stand now, taken from the API and not
  // from anything the browser sent.
  let rewards;
  try {
    const customer = await lookupCustomer(phone, { timeoutMs: 2500 });
    rewards = customer ? applicableRewards(customer.rewards.available) : [];
  } catch (e) {
    console.error("[loyalty] verify lookup failed", e);
    return unavailable;
  }
  return NextResponse.json({ proof: signProof(phone, rewards), rewards });
}
