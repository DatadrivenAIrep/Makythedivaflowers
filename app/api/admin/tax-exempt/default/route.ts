import { NextResponse } from "next/server";
import { getByPhoneUS } from "@/lib/customer-storage";
import { getAccount } from "@/lib/house-account-storage";
import { exemptionStatus, resolveDefaultExemption } from "@/lib/tax-exempt";
import { shopDateStr } from "@/lib/tv-slots";

export const runtime = "nodejs";

// Intake asks which exemption would apply to the order it is building, so the
// toggle shows the same answer the server will reach on submit. /api/admin/* is
// admin-gated by proxy.ts.
export async function GET(req: Request): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const phone = (sp.get("phone") ?? "").replace(/\D/g, "");
  const accountId = sp.get("accountId");
  const customer = phone.length >= 10 ? getByPhoneUS(phone) : null;
  const account = accountId ? getAccount(accountId) : null;
  const today = shopDateStr(new Date());
  const def = resolveDefaultExemption({
    account: account?.taxExemption,
    customer: customer?.taxExemption,
    today,
  });
  const expired = !def && [account?.taxExemption, customer?.taxExemption]
    .some((e) => exemptionStatus(e, today) === "expired");
  return NextResponse.json({ default: def, expired });
}
