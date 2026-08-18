import "server-only";
import twilio, { type Twilio } from "twilio";
import { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } from "@/lib/twilio-config";

let cached: { sid: string; token: string; client: Twilio } | null = null;

export function getTwilioClient(): Twilio | null {
  const sid = twilioAccountSid();
  const token = twilioAuthToken();
  if (!sid || !token) return null;
  if (cached && cached.sid === sid && cached.token === token) return cached.client;
  const client = twilio(sid, token);
  cached = { sid, token, client };
  return client;
}

// Test hook only — vitest stubEnv changes envs but the singleton can leak.
export function __resetTwilioClient(): void {
  cached = null;
}

export function e164(phone: string): string {
  if (phone.startsWith("+")) {
    const rest = phone.slice(1).replace(/\D/g, "");
    return `+${rest}`;
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const c = getTwilioClient();
  if (!c) throw new Error("twilio_not_configured");
  const from = twilioPhoneNumber();
  if (!from) throw new Error("twilio_from_missing");
  const msg = await c.messages.create({ to: e164(to), from, body });
  return { sid: msg.sid };
}

export async function sendWhatsApp(
  to: string,
  contentSid: string,
  contentVariables: Record<string, string>,
): Promise<{ sid: string }> {
  const c = getTwilioClient();
  if (!c) throw new Error("twilio_not_configured");
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error("twilio_whatsapp_from_missing");
  const msg = await c.messages.create({
    to: `whatsapp:${e164(to)}`,
    from,
    contentSid,
    contentVariables: JSON.stringify(contentVariables),
  });
  return { sid: msg.sid };
}
