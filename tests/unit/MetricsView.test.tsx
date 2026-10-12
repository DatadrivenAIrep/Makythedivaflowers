// tests/unit/MetricsView.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import MetricsView from "@/components/admin/metrics/MetricsView";
import type { MetricsPayload } from "@/lib/metrics-storage";

afterEach(() => vi.restoreAllMocks());

const wrap = (ui: React.ReactNode) =>
  render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);

const zeroCh = { web: 0, phone: 0, whatsapp: 0, "walk-in": 0, event: 0 };
const payload: MetricsPayload = {
  range: "30d",
  period: { range: "30d", start: "2026-09-13", end: "2026-10-12", prevStart: "2026-08-14", prevEnd: "2026-09-12", granularity: "day" },
  today: "2026-10-12",
  kpis: {
    revenue: { value: 1248000, delta: { kind: "pct", pct: 18 } },
    orders: { value: 96, delta: { kind: "pct", pct: 9 } },
    aov: { value: 13000, delta: { kind: "pct", pct: 8 } },
    newCustomers: { value: 31, delta: { kind: "pct", pct: -4 } },
    pendingCents: 184000, pendingCount: 7,
    houseAccountsCents: 62000, houseAccountsOverdueCents: 0, houseAccountsOverdueCount: 0,
  },
  trend: [
    { key: "2026-10-11", revenueCents: 50000, orders: 4, prevRevenueCents: 40000, prevOrders: 3 },
    { key: "2026-10-12", revenueCents: 60000, orders: 5, prevRevenueCents: 45000, prevOrders: 4 },
  ],
  insights: [
    { id: "pending_payments", icon: "💳", key: "insight_pending", values: { n: 7, amountCents: 184000 }, refs: {}, action: { kind: "link", href: "/es/admin/dashboard/ledger" } },
    { id: "upcoming_dates", icon: "🎂", key: "insight_upcoming_dates", values: { n: 12 }, refs: {}, action: { kind: "tab", tab: "customers" } },
    { id: "holiday_ahead", icon: "📅", key: "insight_holiday", values: { days: 19, amountCents: 230000 }, refs: { holiday: "halloween" } },
  ],
  sales: {
    channels: [
      { channel: "web", cents: 600000, orders: 40, sharePct: 60, shareDeltaPts: 6 },
      { channel: "phone", cents: 400000, orders: 30, sharePct: 40, shareDeltaPts: -6 },
      { channel: "whatsapp", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: 0 },
      { channel: "walk-in", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: 0 },
      { channel: "event", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: null },
    ],
    channelTrend: [{ key: "2026-10-12", ...zeroCh, web: 60000 }],
    products: [{ key: "a", name: "Docena de rosas", qty: 18, cents: 171000, delta: { kind: "pct", pct: 22 } }],
    promos: { discountCents: 41000, promoOrders: 23, giftCardRedeemedCents: 54000, funeralOrders: 6, funeralSharePct: 11, giftCardsIssuedCents: 125000 },
    byZone: [{ zoneId: "albertson", label: "Albertson", orderCount: 20, cents: 210000 }],
  },
  operations: {
    heatmap: { counts: Array.from({ length: 7 }, (_, d) => (d === 5 ? [3, 12, 9, 2] : [1, 2, 1, 0])), total: 50 },
    upcoming: Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(12 + i).padStart(2, "0")}`, count: i === 5 ? 14 : 3 })),
  },
  customers: {
    split: { newBuyers: 31, newCents: 524000, returningBuyers: 44, returningCents: 724000 },
    top: [{ key: "c1", customerId: "c1", name: "Ana López", cents: 64000, orders: 3 }],
    atRisk: [{ id: "c9", name: "María G.", phone: "5165550109", orderCount: 6, ltvCents: 98000, lastOrderAt: "2026-06-01T15:00:00Z" }],
    atRiskCount: 14,
    upcomingDates: [{ dateId: "d1", customerId: "c1", customerName: "Ana López", phone: "5165550100", kind: "birthday", label: "Mamá Rosa", recipientPhone: "5165550902", date: "2026-10-15", daysUntil: 3 }],
  },
};

describe("MetricsView", () => {
  it("shows the summary: KPIs with deltas, the chart and the insights", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    expect(screen.getByText("$12,480")).toBeDefined();
    expect(screen.getByText("▲ 18%")).toBeDefined();
    expect(screen.getByText("Clientes nuevos")).toBeDefined();
    expect(screen.getByText("7 órdenes con pago pendiente ($1,840).")).toBeDefined();
    expect(screen.getByText("Halloween en 19 días. El año pasado esa semana vendiste $2,300.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Ver" }).getAttribute("href")).toBe("/es/admin/dashboard/ledger");
  });

  it("opens Ventas first and switches tabs", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    expect(screen.getByRole("tab", { name: "Ventas" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Docena de rosas")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Operación" }));
    expect(screen.getByText("Entregas y recogidas por día y franja")).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Clientes" }));
    expect(screen.getByText("Mejores clientes del período")).toBeDefined();
    expect(screen.getByRole("link", { name: "Nuevo pedido" }).getAttribute("href")).toBe(
      "/es/admin/intake?phone=5165550100&rphone=5165550902&rname=Mam%C3%A1+Rosa",
    );
  });

  it("an insight with a tab action jumps to that tab", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    fireEvent.click(screen.getByRole("button", { name: /12 fechas importantes/ }));
    expect(screen.getByRole("tab", { name: "Clientes" }).getAttribute("aria-selected")).toBe("true");
  });

  it("reloads every section for another period", async () => {
    const spy = vi.spyOn(global, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ ...payload, range: "7d", kpis: { ...payload.kpis, orders: { value: 12, delta: { kind: "none" } } } }), { status: 200 }),
    );
    wrap(<MetricsView locale="es" initial={payload} />);
    fireEvent.click(screen.getByRole("button", { name: "7 días" }));
    await waitFor(() => expect(screen.getByText("12")).toBeDefined());
    expect(String(spy.mock.calls[0][0])).toBe("/api/admin/metrics?range=7d&locale=es");
  });
});
