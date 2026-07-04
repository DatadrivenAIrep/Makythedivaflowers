import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import MetricsView from "@/components/admin/metrics/MetricsView";
import type { MetricsPayload } from "@/lib/metrics-storage";

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const payload: MetricsPayload = {
  range: "90d",
  kpis: { revenueCents: 360000, outstandingCents: 12000, orderCount: 42, paidOrderCount: 40, aovCents: 9000, repeatRatePct: 55 },
  monthly: Array.from({ length: 12 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, "0")}`, cents: i * 1000 })),
  topProducts: [
    { key: "p1", name: "Ramo Rosa", qty: 12, cents: null },
    { key: "__custom__", name: "Personalizados", qty: 5, cents: 40000 },
  ],
  byZone: [{ zoneId: "albertson", label: "Albertson", orderCount: 20, cents: 200000 }],
};

describe("MetricsView", () => {
  it("renders KPI values, range buttons, and the two ranked tables", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    expect(screen.getByText("$3,600.00")).toBeDefined(); // revenue
    expect(screen.getByText("Últimos 90 días")).toBeDefined(); // active range button
    expect(screen.getByText("Productos más pedidos")).toBeDefined();
    expect(screen.getByText("Ramo Rosa")).toBeDefined();
    expect(screen.getByText("Ingresos por zona")).toBeDefined();
    expect(screen.getByText("Albertson")).toBeDefined();
  });

  it("shows the custom-products money and a dash for catalog", () => {
    wrap(<MetricsView locale="es" initial={payload} />);
    expect(screen.getByText("$400.00")).toBeDefined(); // custom bucket cents
  });
});
