import { NextResponse } from "next/server";
import { z } from "zod";
import { validateForRedemption } from "@/lib/gift-card-storage";

export const runtime = "nodejs";

const schema = z.object({ code: z.string().min(1).max(50) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ valid: false, reason: "invalid" }, { status: 400 });

  // wantCents is large so applicableCents reflects the full balance for the preview.
  const check = validateForRedemption(parsed.data.code, Number.MAX_SAFE_INTEGER);
  if (!check.ok) return NextResponse.json({ valid: false, reason: check.reason });

  return NextResponse.json({
    valid: true,
    code: check.card.code,
    balanceCents: check.card.balanceCents,
    expiresAt: check.card.expiresAt,
  });
}
