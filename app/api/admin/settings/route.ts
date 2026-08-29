import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getSetting,
  setSetting,
  deleteSetting,
  SETTING_GOOGLE_PLACES_KEY,
  SETTING_GOOGLE_REVIEW_URL,
  SETTING_TWILIO_ACCOUNT_SID,
  SETTING_TWILIO_AUTH_TOKEN,
  SETTING_TWILIO_PHONE_NUMBER,
  SETTING_TWILIO_SMS_ENABLED,
  SETTING_TWILIO_DRY_RUN,
} from "@/lib/settings-storage";
import {
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
  twilioSmsEnabled,
  twilioDryRun,
} from "@/lib/twilio-config";

export const runtime = "nodejs";

// The only keys exposed through this route — guards against free-form injection.
const ALLOWED_KEYS = [
  SETTING_GOOGLE_PLACES_KEY,
  SETTING_GOOGLE_REVIEW_URL,
  SETTING_TWILIO_ACCOUNT_SID,
  SETTING_TWILIO_AUTH_TOKEN,
  SETTING_TWILIO_PHONE_NUMBER,
  SETTING_TWILIO_SMS_ENABLED,
  SETTING_TWILIO_DRY_RUN,
] as const;

const putSchema = z
  .object({ key: z.enum(ALLOWED_KEYS), value: z.string() })
  .superRefine((data, ctx) => {
    const v = data.value.trim();
    if (v === "") return; // empty clears the setting — always allowed
    if (data.key === SETTING_TWILIO_ACCOUNT_SID && !/^AC[a-zA-Z0-9]{32}$/.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_sid", path: ["value"] });
    }
    if (data.key === SETTING_TWILIO_PHONE_NUMBER && !/^\+\d{11,15}$/.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_phone", path: ["value"] });
    }
    if (data.key === SETTING_GOOGLE_REVIEW_URL && !/^https?:\/\/\S+$/.test(v)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_url", path: ["value"] });
    }
    if (
      (data.key === SETTING_TWILIO_SMS_ENABLED || data.key === SETTING_TWILIO_DRY_RUN) &&
      v !== "true" &&
      v !== "false"
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid_flag", path: ["value"] });
    }
  });

function mask(v: string | undefined): string | null {
  return v ? `...${v.slice(-4)}` : null;
}

export async function GET() {
  // Google key is setting-only (no env fallback), kept as-is. Twilio values are
  // resolved (setting ?? env) so the dashboard reflects the effective config.
  const google = getSetting(SETTING_GOOGLE_PLACES_KEY);
  return NextResponse.json({
    [SETTING_GOOGLE_PLACES_KEY]: mask(google ?? undefined),
    // The review URL is a public link, not a secret — return it as-is so the owner
    // can see and verify what they pasted.
    [SETTING_GOOGLE_REVIEW_URL]: getSetting(SETTING_GOOGLE_REVIEW_URL) ?? null,
    [SETTING_TWILIO_ACCOUNT_SID]: mask(twilioAccountSid()),
    [SETTING_TWILIO_AUTH_TOKEN]: mask(twilioAuthToken()),
    [SETTING_TWILIO_PHONE_NUMBER]: twilioPhoneNumber() ?? null,
    [SETTING_TWILIO_SMS_ENABLED]: String(twilioSmsEnabled()),
    [SETTING_TWILIO_DRY_RUN]: String(twilioDryRun()),
    twilio_account_sid_is_setting: !!getSetting(SETTING_TWILIO_ACCOUNT_SID),
    twilio_auth_token_is_setting: !!getSetting(SETTING_TWILIO_AUTH_TOKEN),
  });
}

export async function PUT(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 });
  }
  const { key } = parsed.data;
  const value = parsed.data.value.trim();
  if (value === "") {
    deleteSetting(key);
  } else {
    setSetting(key, value);
  }
  return NextResponse.json({ ok: true });
}
