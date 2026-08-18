import "server-only";
import {
  getSetting,
  SETTING_TWILIO_ACCOUNT_SID,
  SETTING_TWILIO_AUTH_TOKEN,
  SETTING_TWILIO_PHONE_NUMBER,
  SETTING_TWILIO_SMS_ENABLED,
  SETTING_TWILIO_DRY_RUN,
} from "@/lib/settings-storage";

// Each value resolves setting-first, env as fallback. This is the single source
// of truth for "what is Twilio's current config" — the client, the flag guards,
// and the settings GET all read through here.

export function twilioAccountSid(): string | undefined {
  return getSetting(SETTING_TWILIO_ACCOUNT_SID) ?? process.env.TWILIO_ACCOUNT_SID;
}

export function twilioAuthToken(): string | undefined {
  return getSetting(SETTING_TWILIO_AUTH_TOKEN) ?? process.env.TWILIO_AUTH_TOKEN;
}

export function twilioPhoneNumber(): string | undefined {
  return getSetting(SETTING_TWILIO_PHONE_NUMBER) ?? process.env.TWILIO_PHONE_NUMBER;
}

export function twilioSmsEnabled(): boolean {
  return (getSetting(SETTING_TWILIO_SMS_ENABLED) ?? process.env.TWILIO_SMS_ENABLED) === "true";
}

export function twilioDryRun(): boolean {
  return (getSetting(SETTING_TWILIO_DRY_RUN) ?? process.env.TWILIO_DRY_RUN) === "true";
}
