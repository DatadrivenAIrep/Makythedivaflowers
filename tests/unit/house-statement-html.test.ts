import { describe, it, expect } from "vitest";
import { buildStatementHtml, notFoundPage, voidPage } from "@/lib/house-statement-html";
import type { Statement, HouseAccount } from "@/types/house-account";

const account: HouseAccount = {
  id: "ha_1", name: "Hotel <b>Roslyn</b>", billingName: "Ana", billingPhone: "5165550100", billingEmail: "ap@hotel.com",
  locale: "es", cadence: "monthly", issueDay: 1, termsDays: 15, reminderPlan: [], statementChannel: "both",
  status: "active", createdAt: "2026-09-01T12:00:00Z", updatedAt: "2026-09-01T12:00:00Z",
};
const statement: Statement = {
  id: "hst_1", accountId: "ha_1", number: "ST-1001", code: "AbCdEfGh", periodStart: "2026-09-01", periodEnd: "2026-09-30",
  issuedAt: "2026-10-01T13:00:00Z", dueDate: "2026-10-16", openingCents: 0, chargesCents: 8000, creditsCents: 0,
  paymentsCents: 1000, closingCents: 7000, settledCents: 0, status: "open", createdAt: "2026-10-01T13:00:00Z",
  lines: [
    { date: "2026-09-10", kind: "charge", label: "Orden #1001 · Lobby", orderId: "o1", orderNumber: 1001, recipientName: "Lobby", amountCents: 5000 },
    { date: "2026-09-20", kind: "charge", label: "Orden #1002 · Suite 4", orderId: "o2", orderNumber: 1002, recipientName: "Suite 4", amountCents: 3000 },
    { date: "2026-09-25", kind: "payment", label: "Pago · Zelle", method: "zelle", amountCents: -1000 },
  ],
};

describe("buildStatementHtml", () => {
  it("renders an open statement with the pay form, escaped text and noindex", async () => {
    const html = await buildStatementHtml(statement, account, { today: "2026-10-02" });
    expect(html.toLowerCase()).toContain("<!doctype html>");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain("ST-1001");
    expect(html).toContain("Hotel &lt;b&gt;Roslyn&lt;/b&gt;");
    expect(html).not.toContain("<b>Roslyn</b>");
    expect(html).toContain('action="/s/AbCdEfGh/pay"');
    expect(html).toContain("Saldo pendiente");
    expect(html).toContain('class="stamp open"');
    expect(html).toContain("Orden #1001 · Lobby");
    expect(html).toContain("Pago · Zelle");
    expect(html).toContain("$70");
    expect(html).toContain("window.print()");
  });
  it("stamps PAST DUE after the due date (English account)", async () => {
    const html = await buildStatementHtml(statement, { ...account, locale: "en" }, { today: "2026-10-20" });
    expect(html).toContain("Past due");
    expect(html).toContain("Order #1001 · Lobby");
  });
  it("paid: PAID stamp, settled line, no pay form", async () => {
    const html = await buildStatementHtml({ ...statement, status: "paid", settledCents: 7000 }, account, { today: "2026-10-05" });
    expect(html).toContain('class="stamp paid"');
    expect(html).toContain(">Pagado<");
    expect(html).toContain("Pagado / acreditado después de emitido");
    expect(html).toContain("Saldo a pagar");
    expect(html).not.toContain('class="stamp open"');
    expect(html).not.toContain("/pay");
  });
  it("justPaid shows the updating note while still open", async () => {
    const html = await buildStatementHtml(statement, account, { today: "2026-10-05", justPaid: true });
    expect(html).toContain("Pago recibido");
  });
  it("standalone pages", () => {
    expect(notFoundPage()).toContain("No encontramos");
    expect(voidPage("en")).toContain("no longer valid");
  });
});
