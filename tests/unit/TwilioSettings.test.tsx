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

describe("TwilioSettings", () => {
  it("shows the SIMULACIÓN banner when dry-run is on and SMS is live", async () => {
    stubConfig({ twilio_sms_enabled: "true", twilio_dry_run: "true" });
    wrap(<TwilioSettings />);
    expect(await screen.findByText(/MODO PRUEBA/)).toBeDefined();
  });

  it("shows the EN VIVO banner when SMS is live and dry-run is off", async () => {
    stubConfig({ twilio_sms_enabled: "true", twilio_dry_run: "false" });
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
});
