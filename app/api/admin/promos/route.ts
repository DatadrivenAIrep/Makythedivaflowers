import { NextResponse } from "next/server";
import { z } from "zod";
import { createPromo, listPromos } from "@/lib/promo";

export const runtime = "nodejs";

// Admin routes are gated by proxy.ts for the whole /api/admin/* tree.
const createSchema = z.object({
  code: z.string().min(1).max(50),
  kind: z.enum(["percent", "fixed", "free_delivery"]),
  // percent: 1-100 · fixed: cents · free_delivery: unused, so 0 is fine.
  value: z.number().int().min(0),
  minSubtotalCents: z.number().int().min(0).optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  firstOrderOnly: z.boolean().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  note: z.string().max(200).optional(),
});

export async function GET() {
  return NextResponse.json({ promos: listPromos() });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const promo = createPromo(parsed.data);
    return NextResponse.json({ promo });
  } catch (e) {
    // A duplicate code is the common mistake and deserves its own status so the
    // form can say "that code already exists" instead of "something went wrong".
    const message = e instanceof Error ? e.message : "could not create promo";
    const duplicate = message.includes("UNIQUE");
    return NextResponse.json(
      { errors: { formErrors: [duplicate ? "duplicate_code" : message] } },
      { status: duplicate ? 409 : 400 },
    );
  }
}
