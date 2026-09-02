import { NextResponse } from "next/server";
import { z } from "zod";
import { validatePromo } from "@/lib/promo";
import { buyerHasPaidOrder } from "@/lib/buyer-history";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  code: z.string().min(1).max(50),
  subtotalCents: z.number().int().min(0),
  deliveryCents: z.number().int().min(0).default(0),
  // Optional: only needed to gate first-order codes. Guest checkout has no
  // account, so the buyer is identified by what they typed into the form.
  phone: z.string().max(30).optional(),
  email: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  // Codes are guessable by design (short, memorable), so the lookup is rate
  // limited to stop someone enumerating the shop's promotions.
  const ip = ipFromRequest(req);
  const rl = rateLimit(`promo:${ip}`, { max: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ valid: false, reason: "rate_limited" }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, reason: "invalid" }, { status: 400 });
  }
  const { code, subtotalCents, deliveryCents, phone, email } = parsed.data;

  const check = validatePromo(code, {
    subtotalCents,
    deliveryCents,
    buyerHasOrdered: buyerHasPaidOrder({ phone, email }),
    buyerPhone: phone,
  });

  if (!check.ok) {
    return NextResponse.json({
      valid: false,
      reason: check.reason,
      ...(check.minSubtotalCents !== undefined
        ? { minSubtotalCents: check.minSubtotalCents }
        : {}),
    });
  }

  return NextResponse.json({
    valid: true,
    code: check.promo.code,
    kind: check.promo.kind,
    discountCents: check.discountCents,
  });
}
