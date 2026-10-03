import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import AccountDetail from "@/components/admin/accounts/AccountDetail";
import type { AccountDetailData } from "@/lib/house-account-detail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const data: AccountDetailData = {
  account: {
    id: "ha_1", name: "Hotel Roslyn", billingName: "Ana", billingPhone: "5165550100", billingEmail: "ap@hotel.com", locale: "es",
    cadence: "monthly", issueDay: 1, termsDays: 15, reminderPlan: [{ offsetDays: -3, channel: "sms" }], statementChannel: "both",
    status: "active", createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
  },
  balanceCents: 7000,
  statements: [{
    id: "hst_1", accountId: "ha_1", number: "ST-1001", code: "AbCdEfGh", periodStart: "2026-09-01", periodEnd: "2026-09-30",
    issuedAt: "2026-10-01T13:00:00Z", dueDate: "2026-10-16", openingCents: 0, chargesCents: 8000, creditsCents: 0, paymentsCents: 1000,
    closingCents: 7000, settledCents: 0, status: "open", lines: [], createdAt: "2026-10-01T13:00:00Z", dueCents: 7000,
  }],
  entries: [
    { id: "e1", accountId: "ha_1", kind: "charge", amountCents: 8000, orderId: "o1", statementId: "hst_1", actor: "maky", createdAt: "2026-09-10T12:00:00Z", runningCents: 8000 },
    { id: "e2", accountId: "ha_1", kind: "payment", amountCents: -1000, method: "zelle", statementId: "hst_1", actor: "maky", createdAt: "2026-09-25T12:00:00Z", runningCents: 7000 },
  ],
  contacts: [],
  sends: [{ id: "s1", accountId: "ha_1", statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms", scheduledFor: "2026-10-13", status: "scheduled", createdAt: "2026-10-01T13:00:00Z" }],
};

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);
}

describe("AccountDetail", () => {
  it("renders header, sections, statement, ledger and queue rows", () => {
    wrap(<AccountDetail locale="es" initial={data} />);
    expect(screen.getByRole("heading", { name: "Hotel Roslyn" })).toBeDefined();
    expect(screen.getAllByText("$70.00").length).toBeGreaterThan(0);
    for (const title of ["Convenio", "Estados de cuenta", "Movimientos", "Contactos", "Cola de envíos"]) {
      expect(screen.getByText(title)).toBeDefined();
    }
    expect(screen.getByText("ST-1001")).toBeDefined();
    expect(screen.getByText("Pago · Zelle")).toBeDefined();
    expect(screen.getByText("Sin contactos vinculados. Las personas vinculadas se preseleccionan en el intake.")).toBeDefined();
    expect(screen.getByText("Programado")).toBeDefined();
    expect(screen.getByRole("button", { name: "Registrar pago" })).toBeDefined();
  });

  it("keeps the terms collapsed to a summary until Editar is clicked", () => {
    wrap(<AccountDetail locale="es" initial={data} />);
    expect(screen.getByText(/Mensual, día 1 · 15 días de plazo · Estado por SMS \+ email · 1 recordatorio · Ana · 5165550100 · ap@hotel.com/)).toBeDefined();
    expect(screen.queryByText("Nombre comercial")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByText("Nombre comercial")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Nombre comercial")).toBeNull();
  });

  it("labels the queued reminder relative to the due date under Próximos", () => {
    wrap(<AccountDetail locale="es" initial={data} />);
    expect(screen.getByText("Próximos")).toBeDefined();
    expect(screen.getByText(/3 días antes del vencimiento · ST-1001/)).toBeDefined();
  });

  describe("issuing a statement", () => {
    const issuedStatement = { ...data.statements[0], id: "hst_2", number: "ST-1002", code: "ZyXwVuTs" };
    const queuedRow = { id: "q1", accountId: "ha_1", statementId: "hst_2", kind: "statement" as const, stepIndex: 0, channel: "both" as const, scheduledFor: "2026-10-04", status: "scheduled" as const, createdAt: "2026-10-03T13:00:00Z" };
    const afterIssue: AccountDetailData = { ...data, statements: [issuedStatement, ...data.statements], sends: [queuedRow, ...data.sends] };
    const calls: Array<{ method: string; url: string; body: unknown }> = [];

    function mockFetch(patchResponse: unknown = { send: { ...queuedRow, status: "sent" } }) {
      calls.length = 0;
      vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        const ok = (json: unknown) => ({ ok: true, status: 200, json: async () => json });
        if (method === "GET") return ok(afterIssue);
        if (url.endsWith("/statements") && method === "POST") return ok({ statement: { id: "hst_2", number: "ST-1002" } });
        if (url.endsWith("/send") && method === "POST") return ok({ send: { status: "sent" } });
        return ok(patchResponse);
      }));
    }
    const writes = () => calls.filter((c) => c.method !== "GET");
    async function issue() {
      fireEvent.click(screen.getByRole("button", { name: "Emitir estado ahora" }));
      await screen.findByText(/emitido y agregado a la cola de envíos/);
    }
    afterEach(() => vi.unstubAllGlobals());

    it("sends the already queued row (one PATCH sendNow, no manual POST)", async () => {
      mockFetch();
      wrap(<AccountDetail locale="es" initial={data} />);
      await issue();
      fireEvent.click(screen.getByRole("button", { name: "Enviar ahora" }));
      await screen.findByText("Enviado.");
      const w = writes().filter((c) => !c.url.endsWith("/statements"));
      expect(w).toEqual([{ method: "PATCH", url: "/api/admin/accounts/sends/q1", body: { sendNow: true } }]);
    });

    it("sends manually on a different channel, then skips the queued row", async () => {
      mockFetch();
      wrap(<AccountDetail locale="es" initial={data} />);
      await issue();
      const prompt = screen.getByText(/emitido y agregado a la cola de envíos/).parentElement as HTMLElement;
      fireEvent.change(prompt.querySelector("select") as HTMLSelectElement, { target: { value: "sms" } });
      fireEvent.click(screen.getByRole("button", { name: "Enviar ahora" }));
      await screen.findByText("Enviado.");
      const w = writes().filter((c) => !c.url.endsWith("/statements"));
      expect(w).toEqual([
        { method: "POST", url: "/api/admin/accounts/statements/hst_2/send", body: { channel: "sms" } },
        { method: "PATCH", url: "/api/admin/accounts/sends/q1", body: { skip: true } },
      ]);
    });

    it("treats a 200 whose send failed as a failure", async () => {
      mockFetch({ send: { ...queuedRow, status: "failed", error: "Twilio 21211" } });
      wrap(<AccountDetail locale="es" initial={data} />);
      await issue();
      fireEvent.click(screen.getByRole("button", { name: "Enviar ahora" }));
      await waitFor(() => expect(screen.getByText("El envío falló: Twilio 21211")).toBeDefined());
      expect(screen.queryByText("Enviado.")).toBeNull();
    });
  });

  describe("when the server issues nothing", () => {
    function mockNothingIssued(current: AccountDetailData) {
      vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
        const body = (init?.method ?? "GET") === "GET" ? current : { statement: null };
        return { ok: true, status: 200, json: async () => body };
      }));
    }
    afterEach(() => vi.unstubAllGlobals());

    it("explains that a statement already closed today", async () => {
      const closedToday: AccountDetailData = { ...data, statements: [{ ...data.statements[0], periodEnd: "2999-12-31" }] };
      mockNothingIssued(closedToday);
      wrap(<AccountDetail locale="es" initial={closedToday} />);
      fireEvent.click(screen.getByRole("button", { name: "Emitir estado ahora" }));
      await screen.findByText("Ya se emitió un estado hoy. Los movimientos nuevos entran en el próximo.");
    });

    it("says there is nothing to issue when the last statement closed earlier", async () => {
      mockNothingIssued(data);
      wrap(<AccountDetail locale="es" initial={data} />);
      fireEvent.click(screen.getByRole("button", { name: "Emitir estado ahora" }));
      await screen.findByText("Nada que emitir: sin movimientos ni saldo pendiente.");
    });
  });
});
