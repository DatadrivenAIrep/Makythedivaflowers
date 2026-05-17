import { describe, it, expect, beforeEach, vi } from "vitest";
import { e164, getTwilioClient, __resetTwilioClient } from "@/lib/twilio-server";

beforeEach(() => {
  __resetTwilioClient();
  vi.unstubAllEnvs();
});

describe("e164", () => {
  it("normalizes a 10-digit US number", () => {
    expect(e164("5165550100")).toBe("+15165550100");
  });
  it("normalizes a formatted US number", () => {
    expect(e164("(516) 555-0100")).toBe("+15165550100");
  });
  it("normalizes an 11-digit number starting with 1", () => {
    expect(e164("15165550100")).toBe("+15165550100");
  });
  it("passes through an already-formatted international number", () => {
    expect(e164("+525512345678")).toBe("+525512345678");
  });
});

describe("getTwilioClient", () => {
  it("returns null when credentials are missing", () => {
    expect(getTwilioClient()).toBeNull();
  });

  it("returns a client when credentials are set", () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "test_token_value_at_least_32_chars");
    const client = getTwilioClient();
    expect(client).not.toBeNull();
  });
});
