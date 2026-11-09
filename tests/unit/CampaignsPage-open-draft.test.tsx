// tests/unit/CampaignsPage-open-draft.test.tsx
//
// A draft saved earlier (another day, another device) must be reopenable from the
// history table: otherwise it can only be seen, never edited, tested or sent.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import CampaignsPage from "@/components/admin/campaigns/CampaignsPage";
import type { Campaign } from "@/lib/campaign-storage";

const draft: Campaign = {
  id: "cmp_draft",
  bodyEs: "Hola {nombre}, centros de mesa de Thanksgiving.",
  bodyEn: "Hi {nombre}, Thanksgiving centerpieces.",
  segment: "sms-marketing",
  status: "draft",
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  createdAt: "2026-11-09T15:00:00.000Z",
  sentAt: null,
};

const sent: Campaign = {
  ...draft,
  id: "cmp_sent",
  bodyEs: "Campaña de otoño ya enviada.",
  bodyEn: "",
  status: "sent",
  recipientCount: 30,
  sentCount: 30,
  sentAt: "2026-10-01T15:00:00.000Z",
};

const detail = {
  campaign: draft,
  recipientCount: 42,
  previewEs: "Hola Ana, centros de mesa de Thanksgiving. Responde STOP para cancelar.",
  previewEn: "Hi Ana, Thanksgiving centerpieces. Reply STOP to opt out.",
  segmentsEs: 2,
  segmentsEn: 1,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Fake of the admin API, recording every request the page makes. */
function stubApi() {
  const calls: Array<{ url: string; method: string }> = [];
  vi.stubGlobal("scrollTo", () => {}); // not implemented in jsdom
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url === "/api/admin/campaigns" && method === "GET") return json({ campaigns: [draft, sent] });
      if (url === "/api/admin/campaigns/cmp_draft" && (method === "GET" || method === "PATCH")) return json(detail);
      if (url === "/api/admin/campaigns/cmp_draft/send" && method === "POST") {
        return json({ ok: true, sent: 42, failed: 0, skipped: 0 });
      }
      return json({ error: "unexpected" }, 500);
    }),
  );
  return calls;
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      <CampaignsPage locale="es" />
    </NextIntlClientProvider>,
  );
}

async function openSavedDraft() {
  fireEvent.click(await screen.findByRole("button", { name: "Abrir" }));
  await screen.findByRole("button", { name: "Enviar a 42 clientes" });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("reopening a saved campaign draft", () => {
  it("loads both languages and the live preview into the composer", async () => {
    stubApi();
    renderPage();

    await openSavedDraft();

    expect(screen.getByDisplayValue("Hola {nombre}, centros de mesa de Thanksgiving.")).toBeTruthy();
    expect(screen.getByDisplayValue("Hi {nombre}, Thanksgiving centerpieces.")).toBeTruthy();
    expect(screen.getByText("Hi Ana, Thanksgiving centerpieces. Reply STOP to opt out.")).toBeTruthy();
  });

  it("offers Open only on drafts, never on a campaign already sent", async () => {
    stubApi();
    renderPage();

    await screen.findByText("Campaña de otoño ya enviada.");

    expect(screen.getAllByRole("button", { name: "Abrir" })).toHaveLength(1);
  });

  it("sends the reopened draft, not a new one", async () => {
    const calls = stubApi();
    vi.stubGlobal("confirm", () => true);
    renderPage();
    await openSavedDraft();

    fireEvent.click(screen.getByRole("button", { name: "Enviar a 42 clientes" }));

    await waitFor(() =>
      expect(calls).toContainEqual({ url: "/api/admin/campaigns/cmp_draft/send", method: "POST" }),
    );
  });

  it("saves edits onto the same draft instead of creating a duplicate", async () => {
    const calls = stubApi();
    renderPage();
    await openSavedDraft();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar borrador" }));

    await waitFor(() =>
      expect(calls).toContainEqual({ url: "/api/admin/campaigns/cmp_draft", method: "PATCH" }),
    );
    expect(calls.filter((c) => c.url === "/api/admin/campaigns" && c.method === "POST")).toHaveLength(0);
  });
});
