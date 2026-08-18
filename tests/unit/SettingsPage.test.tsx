import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import SettingsPage from "@/components/admin/settings/SettingsPage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          google_places_api_key: "...ab12",
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_phone_number: null,
          twilio_sms_enabled: "false",
          twilio_dry_run: "false",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsPage", () => {
  it("still renders the Google Places field after the SecretField refactor", async () => {
    wrap(<SettingsPage />);
    expect(await screen.findByText("Google Places API Key")).toBeDefined();
    // the masked current value comes back from the mocked GET
    expect(await screen.findByText("...ab12")).toBeDefined();
  });
});
