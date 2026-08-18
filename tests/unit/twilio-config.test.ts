import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import {
  setSetting,
  SETTING_TWILIO_ACCOUNT_SID,
  SETTING_TWILIO_SMS_ENABLED,
  SETTING_TWILIO_DRY_RUN,
} from "@/lib/settings-storage";
import {
  twilioAccountSid,
  twilioSmsEnabled,
  twilioDryRun,
} from "@/lib/twilio-config";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("twilio-config", () => {
  it("setting wins over env", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACenvvalue");
    setSetting(SETTING_TWILIO_ACCOUNT_SID, "ACsettingvalue");
    expect(twilioAccountSid()).toBe("ACsettingvalue");
  });

  it("falls back to env when no setting", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACenvvalue");
    expect(twilioAccountSid()).toBe("ACenvvalue");
  });

  it("undefined when neither setting nor env", () => {
    expect(twilioAccountSid()).toBeUndefined();
  });

  it("twilioSmsEnabled: a 'true' setting overrides a 'false' env", () => {
    vi.stubEnv("TWILIO_SMS_ENABLED", "false");
    setSetting(SETTING_TWILIO_SMS_ENABLED, "true");
    expect(twilioSmsEnabled()).toBe(true);
  });

  it("twilioDryRun parses only 'true' as true", () => {
    setSetting(SETTING_TWILIO_DRY_RUN, "false");
    expect(twilioDryRun()).toBe(false);
    setSetting(SETTING_TWILIO_DRY_RUN, "true");
    expect(twilioDryRun()).toBe(true);
  });
});
