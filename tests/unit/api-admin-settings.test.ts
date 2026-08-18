import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb } from "@/lib/db";
import { setSetting } from "@/lib/settings-storage";
import { GET, PUT } from "@/app/api/admin/settings/route";

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

function put(body: unknown) {
  return PUT(
    new Request("http://x/api/admin/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const VALID_SID = "ACabcdefghijklmnopqrstuvwxyz012345"; // AC + 32 chars

describe("settings route — twilio", () => {
  it("GET masks the sid, returns the phone in full, and flags as booleans", async () => {
    setSetting("twilio_account_sid", VALID_SID);
    setSetting("twilio_phone_number", "+15165551234");
    setSetting("twilio_sms_enabled", "true");
    const body = await (await GET()).json();
    expect(body.twilio_account_sid).toBe("...2345");
    expect(body.twilio_phone_number).toBe("+15165551234");
    expect(body.twilio_sms_enabled).toBe("true");
    expect(body.twilio_dry_run).toBe("false"); // unset setting + unset env → false
  });

  it("GET resolves a value from env when no setting exists", async () => {
    vi.stubEnv("TWILIO_PHONE_NUMBER", "+15169999999");
    const body = await (await GET()).json();
    expect(body.twilio_phone_number).toBe("+15169999999");
  });

  it("PUT rejects a malformed SID", async () => {
    expect((await put({ key: "twilio_account_sid", value: "not-a-sid" })).status).toBe(400);
  });

  it("PUT rejects a non-E.164 phone", async () => {
    expect((await put({ key: "twilio_phone_number", value: "5165551234" })).status).toBe(400);
  });

  it("PUT rejects a flag value other than true/false", async () => {
    expect((await put({ key: "twilio_sms_enabled", value: "yes" })).status).toBe(400);
  });

  it("PUT rejects an unknown key", async () => {
    expect((await put({ key: "evil_key", value: "x" })).status).toBe(400);
  });

  it("PUT stores a valid SID, GET reads it back masked", async () => {
    expect((await put({ key: "twilio_account_sid", value: VALID_SID })).status).toBe(200);
    const body = await (await GET()).json();
    expect(body.twilio_account_sid).toBe("...2345");
  });

  it("PUT with an empty value clears the setting", async () => {
    setSetting("twilio_phone_number", "+15165551234");
    await put({ key: "twilio_phone_number", value: "" });
    const body = await (await GET()).json();
    expect(body.twilio_phone_number).toBeNull(); // no env fallback in this test
  });
});
