import "server-only";
import { sendSms } from "@/lib/twilio-server";
import { twilioDryRun } from "@/lib/twilio-config";
import {
  listMarketingRecipients, getCustomerById, updateCustomer, removeTag,
} from "@/lib/customer-storage";
import {
  getCampaign, markSending, recordSend, finalizeCampaign, type Campaign,
} from "@/lib/campaign-storage";

export const OPT_OUT_FOOTER: Record<"en" | "es", string> = {
  es: "Responde STOP para cancelar.",
  en: "Reply STOP to opt out.",
};

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

/**
 * Render a campaign for one recipient: pick the locale body (EN only when the
 * recipient is EN and body_en is non-empty, else ES), substitute {nombre}/{name}
 * with the first name (dropping the token + a dangling space cleanly when blank),
 * and append the locale opt-out footer.
 */
export function renderCampaignBody(
  campaign: Campaign,
  recipient: { name: string; locale?: "en" | "es" },
): string {
  const useEn = recipient.locale === "en" && campaign.bodyEn.trim().length > 0;
  const locale: "en" | "es" = useEn ? "en" : "es";
  const template = useEn ? campaign.bodyEn : campaign.bodyEs;
  const name = firstName(recipient.name);
  const merged = template
    .replace(/\s*\{(?:nombre|name)\}/g, name ? ` ${name}` : "") // eat a leading space when dropping
    .replace(/\{(?:nombre|name)\}/g, name) // any remaining (start-of-string) token
    .replace(/\s{2,}/g, " ")
    .trim();
  return `${merged} ${OPT_OUT_FOOTER[locale]}`;
}

// GSM 03.38 basic + extension charset. Anything outside it forces UCS-2.
const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà" +
  "^{}\\[~]|€";

/** Estimate SMS segments for the preview (GSM-7: 160/153; UCS-2: 70/67). */
export function smsSegments(body: string): number {
  const chars = [...body];
  const gsm7 = chars.every((ch) => GSM7.includes(ch));
  const len = chars.length;
  if (gsm7) return len <= 160 ? 1 : Math.ceil(len / 153);
  return len <= 70 ? 1 : Math.ceil(len / 67);
}

function isCode21610(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: number }).code === 21610;
}

/**
 * Send a draft campaign to its opted-in segment, synchronously. Idempotent via
 * markSending. Per-recipient: re-check channel, honor dry-run, record every
 * attempt, never let one failure abort the batch. A Twilio 21610 (unsubscribed)
 * is reclassified as skipped and synced back as an opt-out.
 */
export async function sendCampaign(id: string): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!markSending(id)) return { sent: 0, failed: 0, skipped: 0 };
  const campaign = getCampaign(id)!;
  const recipients = listMarketingRecipients(campaign.segment);
  const dry = twilioDryRun();
  let sent = 0, failed = 0, skipped = 0;

  for (const r of recipients) {
    // Re-check at send time — a STOP may have landed since the list was built.
    const fresh = getCustomerById(r.id);
    if (fresh?.messagingChannel === "none") {
      recordSend({ campaignId: id, customerId: r.id, phone: r.phone, status: "skipped", error: "opted_out" });
      skipped++;
      continue;
    }
    const body = renderCampaignBody(campaign, { name: r.name, locale: r.locale });
    if (dry) {
      recordSend({ campaignId: id, customerId: r.id, phone: r.phone, status: "dry_run" });
      sent++; // count dry sends as "sent" for the tally the owner sees
      continue;
    }
    try {
      const { sid } = await sendSms(r.phone, body);
      recordSend({ campaignId: id, customerId: r.id, phone: r.phone, status: "sent", providerSid: sid });
      sent++;
    } catch (e) {
      if (isCode21610(e)) {
        updateCustomer(r.id, { messagingChannel: "none" });
        removeTag(r.id, "sms-marketing");
        recordSend({ campaignId: id, customerId: r.id, phone: r.phone, status: "skipped", error: "21610" });
        skipped++;
      } else {
        recordSend({
          campaignId: id, customerId: r.id, phone: r.phone, status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
        failed++;
      }
    }
  }
  finalizeCampaign(id, { sent, failed });
  return { sent, failed, skipped };
}
