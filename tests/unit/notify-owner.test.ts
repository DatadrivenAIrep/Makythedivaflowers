import { describe, it, expect, beforeEach, vi } from "vitest";

const sendSmsMock = vi.fn();
vi.mock("@/lib/twilio-server", () => ({ sendSms: (...a: unknown[]) => sendSmsMock(...a) }));
const twilioSmsEnabledMock = vi.fn();
const twilioDryRunMock = vi.fn();
vi.mock("@/lib/twilio-config", () => ({
  twilioSmsEnabled: () => twilioSmsEnabledMock(),
  twilioDryRun: () => twilioDryRunMock(),
}));

import { notifyOwner } from "@/lib/notify-owner";
import { SITE } from "@/data/site";

beforeEach(() => {
  sendSmsMock.mockReset().mockResolvedValue({ sid: "SM1" });
  twilioSmsEnabledMock.mockReset().mockReturnValue(true);
  twilioDryRunMock.mockReset().mockReturnValue(false);
});

describe("notifyOwner", () => {
  it("sends to the owner mobile when enabled and not dry-run", async () => {
    await notifyOwner("hola");
    expect(sendSmsMock).toHaveBeenCalledWith(SITE.mobile.e164, "hola");
  });
  it("skips when SMS is disabled", async () => {
    twilioSmsEnabledMock.mockReturnValue(false);
    await notifyOwner("hola");
    expect(sendSmsMock).not.toHaveBeenCalled();
  });
  it("skips (logs) in dry-run", async () => {
    twilioDryRunMock.mockReturnValue(true);
    await notifyOwner("hola");
    expect(sendSmsMock).not.toHaveBeenCalled();
  });
  it("never throws when sendSms rejects", async () => {
    sendSmsMock.mockRejectedValue(new Error("boom"));
    await expect(notifyOwner("hola")).resolves.toBeUndefined();
  });
});
