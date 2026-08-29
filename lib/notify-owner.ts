import "server-only";
import { SITE } from "@/data/site";
import { twilioSmsEnabled, twilioDryRun } from "@/lib/twilio-config";
import { sendSms } from "@/lib/twilio-server";

/**
 * Sends an operational SMS to the shop owner's mobile. No customer consent — it
 * is the owner's own phone, not an A2P/marketing message. Respects the
 * sms-enabled and dry-run flags, and NEVER throws: a failed alert must not break
 * the order or lead flow that triggered it.
 */
export async function notifyOwner(message: string): Promise<void> {
  try {
    if (!twilioSmsEnabled()) {
      console.log(JSON.stringify({ event: "notify_owner_skipped", reason: "sms_disabled" }));
      return;
    }
    if (twilioDryRun()) {
      console.log(JSON.stringify({ event: "notify_owner_dry_run", message }));
      return;
    }
    await sendSms(SITE.mobile.e164, message);
  } catch (e) {
    console.error(
      JSON.stringify({ event: "notify_owner_failed", error: e instanceof Error ? e.message : String(e) }),
    );
  }
}
