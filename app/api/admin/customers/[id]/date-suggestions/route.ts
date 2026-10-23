import { NextResponse } from "next/server";
import { z } from "zod";
import { getCustomerById } from "@/lib/customer-storage";
import { addImportantDate, dismissSuggestion, listDatesFor } from "@/lib/customer-dates-storage";
import { dateSuggestionsFor } from "@/lib/customer-profile";
import { recipientsForSender } from "@/lib/recipient-history";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), key: z.string().min(1).max(120), kind: z.enum(["birthday", "anniversary", "custom"]) }),
  z.object({ action: z.literal("dismiss"), key: z.string().min(1).max(120) }),
]);

// Save or dismiss a suggested date. The suggestion is looked up again here, so
// the client only names it — the date and the recipient always come from history.
export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  const customer = getCustomerById(id);
  if (!customer) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const recipients = recipientsForSender({ customerId: id, phone: customer.phone });
  const suggestion = dateSuggestionsFor(id, recipients, listDatesFor(id)).find((s) => s.key === parsed.data.key);
  if (!suggestion) return NextResponse.json({ error: "suggestion_not_found" }, { status: 404 });

  if (parsed.data.action === "dismiss") {
    dismissSuggestion(id, suggestion.key);
  } else {
    addImportantDate(id, {
      kind: parsed.data.kind,
      label: suggestion.recipientName,
      month: suggestion.month,
      day: suggestion.day,
      recipientPhone: suggestion.recipientPhone || undefined,
    });
  }
  const dates = listDatesFor(id);
  return NextResponse.json({ dates, dateSuggestions: dateSuggestionsFor(id, recipients, dates) });
}
