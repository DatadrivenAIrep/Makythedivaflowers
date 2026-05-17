import "server-only";
import twilio, { type Twilio } from "twilio";

let cachedClient: Twilio | null = null;

export function getTwilioClient(): Twilio | null {
  if (cachedClient) return cachedClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  cachedClient = twilio(sid, token);
  return cachedClient;
}

// Test hook only — vitest stubEnv changes envs but the singleton can leak.
export function __resetTwilioClient(): void {
  cachedClient = null;
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
  const from = process.env.TWILIO_PHONE_NUMBER;
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
