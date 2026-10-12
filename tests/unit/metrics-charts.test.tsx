import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import KpiCard from "@/components/admin/metrics/KpiCard";
import SalesTrendChart from "@/components/admin/metrics/SalesTrendChart";
import ChannelColumns from "@/components/admin/metrics/ChannelColumns";
import HeatmapGrid from "@/components/admin/metrics/Heatmap";
import UpcomingLoad from "@/components/admin/metrics/UpcomingLoad";
import { money, bucketLabel } from "@/components/admin/metrics/format";

const wrap = (ui: React.ReactNode) =>
  render(<NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>{ui}</NextIntlClientProvider>);

const points = [
  { key: "2026-08", revenueCents: 840000, orders: 60, prevRevenueCents: 710000, prevOrders: 50 },
  { key: "2026-09", revenueCents: 1020000, orders: 80, prevRevenueCents: 800000, prevOrders: 61 },
  { key: "2026-10", revenueCents: 1250000, orders: 96, prevRevenueCents: 1060000, prevOrders: 70 },
];

describe("format", () => {
  it("formats money and bucket labels", () => {
    expect(money(1248000)).toBe("$12,480");
    expect(money(1248000, true)).toBe("$12.5K");
    expect(bucketLabel("2026-10", "month", "es")).toBe("oct");
    expect(bucketLabel("2026-10-12", "day", "es")).toBe("12 oct");
  });
});

describe("KpiCard", () => {
  it("shows the delta with its direction", () => {
    wrap(<KpiCard label="Ingresos cobrados" value="$12,480" delta={{ kind: "pct", pct: 18 }} />);
    expect(screen.getByText("▲ 18%")).toBeDefined();
  });
  it("says 'nuevo' when there was nothing before", () => {
    wrap(<KpiCard label="Órdenes" value="3" delta={{ kind: "new" }} />);
    expect(screen.getByText("nuevo")).toBeDefined();
  });
});

describe("SalesTrendChart", () => {
  it("labels the last point, has a data table, and switches to orders", () => {
    wrap(<SalesTrendChart points={points} granularity="month" locale="es" />);
    expect(screen.getByText("$12.5K")).toBeDefined();
    expect(screen.getByRole("table", { name: "Ventas · este año vs año pasado" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Órdenes" }));
    expect(screen.getAllByText("96").length).toBeGreaterThan(0);
  });
  it("shows both years for the point under focus", () => {
    wrap(<SalesTrendChart points={points} granularity="month" locale="es" />);
    const plot = screen.getByRole("img", { name: "Ventas · este año vs año pasado" });
    fireEvent.focus(plot);
    fireEvent.keyDown(plot, { key: "ArrowLeft" });
    const tip = screen.getByRole("status");
    expect(tip.textContent).toContain("$10,200");
    expect(tip.textContent).toContain("$8,000");
  });
});

describe("ChannelColumns", () => {
  it("lists every channel with its share and change in the legend", () => {
    const zero = { web: 0, phone: 0, whatsapp: 0, "walk-in": 0, event: 0 };
    wrap(
      <ChannelColumns
        granularity="month" locale="es"
        buckets={[{ key: "2026-10", ...zero, web: 600000, phone: 400000 }]}
        shares={[
          { channel: "web", cents: 600000, orders: 40, sharePct: 60, shareDeltaPts: 6 },
          { channel: "phone", cents: 400000, orders: 30, sharePct: 40, shareDeltaPts: -6 },
          { channel: "whatsapp", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: 0 },
          { channel: "walk-in", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: 0 },
          { channel: "event", cents: 0, orders: 0, sharePct: 0, shareDeltaPts: null },
        ]}
      />,
    );
    expect(screen.getByText("Web 60%")).toBeDefined();
    expect(screen.getByText("+6 pts")).toBeDefined();
    expect(screen.getByText("Tienda 0%")).toBeDefined();
  });
});

describe("HeatmapGrid and UpcomingLoad", () => {
  it("prints each cell's count under weekday and slot headers", () => {
    const counts = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
    counts[5][1] = 12;
    wrap(<HeatmapGrid heatmap={{ counts, total: 12 }} />);
    expect(screen.getByText("Sáb")).toBeDefined();
    expect(screen.getByText("Mediodía")).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
  });
  it("names the busiest upcoming days", () => {
    wrap(
      <UpcomingLoad
        locale="es"
        days={Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(12 + i).padStart(2, "0")}`, count: i === 5 ? 14 : 2 }))}
      />,
    );
    expect(screen.getByText(/14 pedidos/)).toBeDefined();
  });
});
