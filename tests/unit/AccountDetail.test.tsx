import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
});
