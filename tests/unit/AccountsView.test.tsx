// tests/unit/AccountsView.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import AccountsView from "@/components/admin/accounts/AccountsView";
import type { AccountListItem } from "@/lib/house-account-storage";
import type { UpcomingSend } from "@/lib/house-account-sends";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const account: AccountListItem = {
  id: "ha_1", name: "Hotel Roslyn", locale: "es", cadence: "monthly", issueDay: 1, termsDays: 15, reminderPlan: [],
  statementChannel: "both", status: "active", createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
  balanceCents: 70000, oldestOpen: { id: "hst_1", number: "ST-1001", dueDate: "2026-09-30", dueCents: 70000 },
  overdue: true, lastPaymentAt: null, nextIssueDate: "2026-11-01",
};
const upcoming: UpcomingSend = {
  id: "hsd_1", accountId: "ha_1", statementId: "hst_1", kind: "reminder", stepIndex: 0, channel: "sms",
  scheduledFor: "2026-10-05", status: "scheduled", createdAt: "2026-10-01T13:00:00Z",
  accountName: "Hotel Roslyn", statementNumber: "ST-1001", dueDate: "2026-10-16",
};

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);
}

describe("AccountsView", () => {
  it("lists accounts with balance, overdue badge and the upcoming strip", () => {
    wrap(<AccountsView locale="es" initialAccounts={[account]} initialUpcoming={[upcoming]} />);
    expect(screen.getAllByText("Hotel Roslyn").length).toBeGreaterThan(0);
    expect(screen.getByText("$700.00")).toBeDefined();
    expect(screen.getByText("Vencido")).toBeDefined();
    expect(screen.getByText("Próximos envíos (7 días)")).toBeDefined();
    expect(screen.getByText(/11 días antes del vencimiento · ST-1001 · SMS/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Enviar ya" })).toBeDefined();
  });
  it("shows the empty states", () => {
    wrap(<AccountsView locale="es" initialAccounts={[]} initialUpcoming={[]} />);
    expect(screen.getByText("Todavía no hay cuentas.")).toBeDefined();
    expect(screen.getByText("Nada programado para los próximos 7 días.")).toBeDefined();
  });
  describe("Enviar ya", () => {
    afterEach(() => vi.unstubAllGlobals());
    function stubFetch(send: Record<string, unknown>) {
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") return new Response(JSON.stringify({ send }), { status: 200 });
        return new Response(JSON.stringify({ accounts: [account], upcoming: [upcoming] }), { status: 200 });
      });
      vi.stubGlobal("fetch", fetchMock);
    }
    it("shows the failure reason when the 200 carries a failed send", async () => {
      stubFetch({ id: "hsd_1", status: "failed", error: "Twilio 21211" });
      wrap(<AccountsView locale="es" initialAccounts={[account]} initialUpcoming={[upcoming]} />);
      fireEvent.click(screen.getByRole("button", { name: "Enviar ya" }));
      await waitFor(() => expect(screen.getByText("El envío falló: Twilio 21211")).toBeDefined());
      expect(screen.queryByText("Enviado.")).toBeNull();
    });
    it("confirms when the send really went out", async () => {
      stubFetch({ id: "hsd_1", status: "sent" });
      wrap(<AccountsView locale="es" initialAccounts={[account]} initialUpcoming={[upcoming]} />);
      fireEvent.click(screen.getByRole("button", { name: "Enviar ya" }));
      await waitFor(() => expect(screen.getByText("Enviado.")).toBeDefined());
    });
  });
});
