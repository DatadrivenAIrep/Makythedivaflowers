import { NextResponse } from "next/server";
import { getByPhone } from "@/lib/customer-storage";
import { recipientProfile, recipientsForSender } from "@/lib/recipient-history";

export const runtime = "nodejs";

// One phone, both roles: the caller as a sender (customer record + everyone they
// send to) and the same number as a recipient of other people's orders.
export async function GET(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone");
  if (!phone) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }
  const customer = getByPhone(phone);
  const recipients = recipientsForSender({ customerId: customer?.id, phone });
  const asRecipient = recipientProfile(phone);
  if (!customer) return NextResponse.json({ found: false, recipients, asRecipient });
  return NextResponse.json({ found: true, customer, recipients, asRecipient });
}
