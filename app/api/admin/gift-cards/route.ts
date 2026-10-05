import { NextResponse } from "next/server";
import { issueGiftCardSchema } from "@/schemas/gift-card";
import { issueGiftCard, listGiftCards } from "@/lib/gift-card-storage";
import { notifyGiftCardIssued } from "@/lib/gift-card-notifications";
import { notifyGiftCardSms } from "@/lib/gift-card-sms";

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
    recipientPhone: input.recipientPhone,
    fromLabel: input.fromLabel,
    personalMessage: input.personalMessage,
    headline: input.headline,
    partner: input.partner,
    reason: input.reason,
    issuedBy: "maky", // matches the hardcoded operator used by intake (takenBy)
  });

  // Email failure must NOT roll back issuance — the card exists and staff can resend.
  // Same for the SMS: it never blocks issuance, and it is skipped without a phone.
  const [mail, sms] = await Promise.all([
    notifyGiftCardIssued(card, "en"),
    notifyGiftCardSms(card, "en"),
  ]);
  return NextResponse.json({
    card,
    emailSent: mail.sent,
    emailError: mail.error,
    smsSent: sms.status === "sent",
    smsError: sms.status === "sent" ? undefined : sms.error,
  });
}
