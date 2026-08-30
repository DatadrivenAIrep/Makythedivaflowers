import twilio from "twilio";
import { twilioAuthToken } from "@/lib/twilio-config";
import { getByPhoneUS, updateCustomer, removeTag, normalizePhone } from "@/lib/customer-storage";
import { insertInboundMessage } from "@/lib/inbound-storage";

export const runtime = "nodejs";

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "BAJA"]);
const START_WORDS = new Set(["START", "YES", "UNSTOP", "ALTA"]);

const TWIML_EMPTY = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>";

function xml(status = 200): Response {
  return new Response(TWIML_EMPTY, { status, headers: { "content-type": "text/xml" } });
}

// Twilio signs the exact public URL it POSTed to. Reconstruct it from proxy headers.
function publicUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}/api/twilio/inbound`;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const token = twilioAuthToken();
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const raw = await req.text();
    const params = Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;

    // Signature check — the only thing protecting this public URL from forgery.
    if (!token || !twilio.validateRequest(token, signature, publicUrl(req), params)) {
      return xml(403);
    }

    const from = params.From ?? "";
    const body = params.Body ?? "";
    const keyword = body.trim().toUpperCase();
    const customer = from ? getByPhoneUS(from) : null;

    // Persist every inbound message for the inbox (STOP/START included).
    // Best-effort: a storage failure here must never suppress the STOP/START
    // opt-out sync below, since Twilio only gets one shot at 200 (no retry).
    if (from) {
      try {
        insertInboundMessage({
          fromPhone: normalizePhone(from),
          customerId: customer?.id,
          body,
          providerSid: params.MessageSid,
        });
      } catch (e) {
        console.error(
          JSON.stringify({ event: "inbound_store_failed", error: e instanceof Error ? e.message : String(e) }),
        );
      }
    }

    if (customer) {
      if (STOP_WORDS.has(keyword)) {
        updateCustomer(customer.id, { messagingChannel: "none" });
        removeTag(customer.id, "sms-marketing");
        console.log(JSON.stringify({ event: "sms_opt_out", customerId: customer.id }));
      } else if (START_WORDS.has(keyword) && customer.messagingChannel === "none") {
        updateCustomer(customer.id, { messagingChannel: "sms" });
        console.log(JSON.stringify({ event: "sms_opt_in", customerId: customer.id }));
      }
    }
    return xml(200);
  } catch (e) {
    // Never retry a sync failure into a loop; Twilio's carrier block already happened.
    console.error(
      JSON.stringify({ event: "twilio_inbound_failed", error: e instanceof Error ? e.message : String(e) }),
    );
    return xml(200);
  }
}
