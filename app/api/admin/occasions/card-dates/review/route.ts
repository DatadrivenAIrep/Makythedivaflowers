import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { listCardReviews, resolveCardReview } from "@/lib/card-dates-scan";
import { routeFailed } from "@/lib/card-dates-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const bodySchema = z.object({
  orderId: z.string().min(1).max(80),
  action: z.enum(["birthday", "anniversary", "dismiss"]),
  name: z.string().max(40).optional(),
});

/** Staff settle one order left in review. */
export async function POST(req: Request): Promise<Response> {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400, headers: NO_STORE });
  }
  const { orderId, action, name } = parsed.data;
  try {
    const result = resolveCardReview(orderId, action === "dismiss" ? "dismiss" : { kind: action, name });
    if (result === "not_found") return NextResponse.json({ result }, { status: 404, headers: NO_STORE });
    if (result === "name_required") return NextResponse.json({ result }, { status: 400, headers: NO_STORE });
    return NextResponse.json({ result, reviews: listCardReviews() }, { headers: NO_STORE });
  } catch (e) {
    return routeFailed(e);
  }
}
