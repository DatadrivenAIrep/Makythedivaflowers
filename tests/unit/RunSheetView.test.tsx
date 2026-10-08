import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import type { Order } from "@/types/order";

// The shell (nav, SMS polling, router) and the drawer are out of scope here.
vi.mock("@/components/admin/dashboard/DashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/admin/dashboard/OrderDetailDrawer", () => ({ default: () => null }));

import RunSheetView, { RUN_SHEET_VIEW_KEY } from "@/components/admin/dashboard/RunSheetView";

function deliveryOrder(id: string, name: string, zip: string): Order {
  return {
    id, source: "web", locale: "es", lines: [],
    fulfillment: {
      method: "delivery",
      recipient: { name, phone: "5551234567" },
      address: { street1: "1 Main St", city: "Elsewhere", state: "NY", zip, country: "US" },
      window: { date: "2026-07-04", slot: "midday" },
    },
    contact: { phone: "5551234567" },
    totals: { subtotalCents: 5000, deliveryCents: 1000, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 6000 },
    status: "pending", paymentStatus: "paid",
    createdAt: "2026-07-04T00:00:00Z", updatedAt: "2026-07-04T00:00:00Z",
  };
}

const orders = [deliveryOrder("r", "Reci Ros", "11576"), deliveryOrder("a", "Reci Alb", "11507")];

function wrap() {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages as Record<string, unknown>}>
      <RunSheetView locale="es" />
    </NextIntlClientProvider>,
  );
}

const headers = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("RunSheetView view toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ date: "2026-07-04", orders }))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("defaults to by-time, switches to by-zone and remembers the choice", async () => {
    wrap();
    await waitFor(() => expect(screen.getByText("Reci Ros")).toBeDefined());
    const byTime = screen.getByRole("button", { name: "Por hora" });
    const byZone = screen.getByRole("button", { name: "Por zona" });
    expect(byTime.getAttribute("aria-pressed")).toBe("true");
    expect(headers()).toEqual(["Mediodía · 2"]);

    fireEvent.click(byZone);
    expect(byZone.getAttribute("aria-pressed")).toBe("true");
    expect(headers()).toEqual(["Albertson · 1", "Roslyn · 1"]);
    expect(localStorage.getItem(RUN_SHEET_VIEW_KEY)).toBe("zone");

    fireEvent.click(byTime);
    expect(headers()).toEqual(["Mediodía · 2"]);
    expect(localStorage.getItem(RUN_SHEET_VIEW_KEY)).toBe("time");
  });

  it("restores the remembered by-zone view on mount", async () => {
    localStorage.setItem(RUN_SHEET_VIEW_KEY, "zone");
    wrap();
    await waitFor(() => expect(headers()).toEqual(["Albertson · 1", "Roslyn · 1"]));
    expect(screen.getByRole("button", { name: "Por zona" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("falls back to by-time when storage throws", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    try {
      wrap();
      await waitFor(() => expect(screen.getByText("Reci Ros")).toBeDefined());
      expect(headers()).toEqual(["Mediodía · 2"]);
      fireEvent.click(screen.getByRole("button", { name: "Por zona" }));
      expect(headers()).toEqual(["Albertson · 1", "Roslyn · 1"]);
    } finally {
      spy.mockRestore();
      setSpy.mockRestore();
    }
  });
});
