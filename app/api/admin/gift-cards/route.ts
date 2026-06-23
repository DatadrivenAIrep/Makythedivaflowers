import { NextResponse } from "next/server";
import { issueGiftCardSchema } from "@/schemas/gift-card";
import { issueGiftCard, listGiftCards } from "@/lib/gift-card-storage";
import { notifyGiftCardIssued } from "@/lib/gift-card-notifications";

export const runtime = "nodejs";

export async function GET() {
  const { cards, stats } = listGiftCards();
  return NextResponse.json({ cards, stats });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = issueGiftCardSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const input = parsed.data;
  const card = issueGiftCard({
    initialCents: input.amountCents,
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    fromLabel: input.fromLabel,
    personalMessage: input.personalMessage,
    reason: input.reason,
    issuedBy: "maky", // matches the hardcoded operator used by intake (takenBy)
  });

  // Email failure must NOT roll back issuance — the card exists and staff can resend.
  const mail = await notifyGiftCardIssued(card, "es");
  return NextResponse.json({ card, emailSent: mail.sent, emailError: mail.error });
}
