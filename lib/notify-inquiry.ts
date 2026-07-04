// lib/notify-inquiry.ts
import { Resend } from "resend";
import type { InquiryRecord } from "@/lib/inquiry-storage";

type ContactLike = { contact?: { name?: string; email?: string; phone?: string } };

function contactOf(record: InquiryRecord): { name: string; email: string; phone: string } {
  const c = (record.payload as ContactLike)?.contact ?? {};
  return { name: c.name ?? "—", email: c.email ?? "—", phone: c.phone ?? "—" };
}

/**
 * Best-effort email alert for a new inquiry. Never throws; no-ops when the
 * Resend key or destination address are not configured (local/dev, or a host
 * where env vars aren't set yet — see the Hostinger deploy note).
 */
export async function notifyInquiry(record: InquiryRecord): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INQUIRY_NOTIFY_EMAIL;
  const from = process.env.INQUIRY_NOTIFY_FROM ?? "Diva Flowers <inquiries@makythedivaflowers.com>";
  if (!apiKey || !to) return;

  try {
    const { name, email, phone } = contactOf(record);
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to,
      subject: `New ${record.type} inquiry — ${email}`,
      text: [
        `Type: ${record.type}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Locale: ${record.locale}`,
        `Received: ${record.createdAt}`,
        `Inquiry ID: ${record.id}`,
        ``,
        `Full payload:`,
        JSON.stringify(record.payload, null, 2),
      ].join("\n"),
    });
  } catch (err) {
    console.error(`[notify-inquiry] failed for ${record.id}:`, err);
  }
}
