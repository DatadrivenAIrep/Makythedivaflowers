import "server-only";
import { getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

export type SettingsRow = { key: string; value: string; updated_at: string };

export function getSetting(key: string): string | null {
  runMigrations();
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  runMigrations();
  getDb()
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
    )
    .run(key, value, new Date().toISOString());
}

export function deleteSetting(key: string): void {
  getDb().prepare("DELETE FROM settings WHERE key = ?").run(key);
}

export const SETTING_GOOGLE_PLACES_KEY = "google_places_api_key";

export const SETTING_TWILIO_ACCOUNT_SID = "twilio_account_sid";
export const SETTING_TWILIO_AUTH_TOKEN = "twilio_auth_token";
export const SETTING_TWILIO_PHONE_NUMBER = "twilio_phone_number";
export const SETTING_TWILIO_SMS_ENABLED = "twilio_sms_enabled";
export const SETTING_TWILIO_DRY_RUN = "twilio_dry_run";
