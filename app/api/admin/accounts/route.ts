import { NextResponse } from "next/server";
import { listAccounts, createAccount, type AccountFilter } from "@/lib/house-account-storage";
import { upcomingSends } from "@/lib/house-account-sends";
import { shopDateStr } from "@/lib/tv-slots";
import { accountBody } from "@/schemas/house-account";

export const runtime = "nodejs";

const FILTERS = new Set<string>(["all", "with_balance", "overdue", "paused"]);

export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const f = sp.get("filter");
  const today = shopDateStr(new Date());
  return NextResponse.json({
    accounts: listAccounts({ q: sp.get("q") ?? undefined, filter: f && FILTERS.has(f) ? (f as AccountFilter) : "all", today }),
    upcoming: upcomingSends(7, today),
  });
}

export async function POST(req: Request): Promise<Response> {
  const parsed = accountBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  try {
    const account = createAccount({ ...parsed.data, billingEmail: parsed.data.billingEmail || undefined });
    return NextResponse.json({ account }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
