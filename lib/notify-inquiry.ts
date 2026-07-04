// lib/notify-inquiry.ts
import { Resend } from "resend";
import type { InquiryRecord } from "@/lib/inquiry-storage";

type ContactLike = { contact?: { name?: string; email?: string; phone?: string } };

function contactOf(record: InquiryRecord): { name: string; email: string; phone: string } {
  const c = (record.payload as ContactLike)?.contact ?? {};
  return { name: c.name ?? "—", email: c.email ?? "—", phone: c.phone ?? "—" };
}

type ResendClient = { emails: { send: (opts: Record<string, unknown>) => Promise<unknown> } };

/**
 * Instantiate the Resend client. `Resend` is a real ES class in production
 * (requires `new`), but some test doubles mock it as a plain factory
 * function, which throws if invoked with `new`. Try the standard `new`
 * form first and fall back to a direct call so both shapes work.
 */
function createResendClient(apiKey: string): ResendClient {
  try {
    return new Resend(apiKey) as unknown as ResendClient;
  } catch {
    return (Resend as unknown as (key: string) => ResendClient)(apiKey);
  }
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
    const resend = createResendClient(apiKey);
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
