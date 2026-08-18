import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import TwilioSettings from "@/components/admin/settings/TwilioSettings";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function stubConfig(over: Record<string, unknown> = {}) {
  const cfg = {
    google_places_api_key: null,
    twilio_account_sid: null,
    twilio_auth_token: null,
    twilio_phone_number: null,
    twilio_sms_enabled: "false",
    twilio_dry_run: "false",
    twilio_account_sid_is_setting: false,
    twilio_auth_token_is_setting: false,
    ...over,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { method?: string }) => {
      if (init?.method === "PUT" || init?.method === "POST") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify(cfg), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const FULL_CREDS = {
  twilio_account_sid: "...2345",
  twilio_auth_token: "...6789",
  twilio_phone_number: "+15165551234",
};

describe("TwilioSettings", () => {
  it("shows the SIMULACIÓN banner when dry-run is on and SMS is live", async () => {
    stubConfig({ twilio_sms_enabled: "true", twilio_dry_run: "true", ...FULL_CREDS });
    wrap(<TwilioSettings />);
    expect(await screen.findByText(/MODO PRUEBA/)).toBeDefined();
  });

  it("shows the EN VIVO banner when SMS is live and dry-run is off", async () => {
    stubConfig({ twilio_sms_enabled: "true", twilio_dry_run: "false", ...FULL_CREDS });
    wrap(<TwilioSettings />);
    expect(await screen.findByText(/EN VIVO/)).toBeDefined();
  });

  it("shows the off banner when SMS is disabled", async () => {
    stubConfig({ twilio_sms_enabled: "false" });
    wrap(<TwilioSettings />);
    expect(await screen.findByText(/SMS apagado/)).toBeDefined();
  });

  it("posts to the test endpoint when the test button is clicked", async () => {
    stubConfig({ twilio_sms_enabled: "true" });
    wrap(<TwilioSettings />);
    const btn = await screen.findByText("Enviar SMS de prueba");
    fireEvent.click(btn);
    // fetch was called with the test endpoint at least once
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls.some((c) => String(c[0]).includes("/twilio-test"))).toBe(true);
  });

  it("shows the missing-credentials banner when SMS is live but a credential is missing", async () => {
    stubConfig({
      twilio_sms_enabled: "true",
      twilio_dry_run: "false",
      twilio_account_sid: "...2345" /* token/phone still null */,
    });
    wrap(<TwilioSettings />);
    expect(await screen.findByText(/Faltan credenciales/)).toBeDefined();
  });

  it("hides the Quitar button and shows the env-source note when the value comes from env, not a setting", async () => {
    stubConfig({
      twilio_account_sid: "...2345",
      twilio_account_sid_is_setting: false,
    });
    wrap(<TwilioSettings />);
    await screen.findByText("...2345");
    expect(screen.queryByText("Quitar")).toBeNull();
    expect(await screen.findByText("definido en el servidor")).toBeDefined();
  });
});
