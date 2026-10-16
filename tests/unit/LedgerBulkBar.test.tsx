import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k} ${JSON.stringify(v)}` : k),
  useLocale: () => "es",
}));

import LedgerBulkBar from "@/components/admin/dashboard/LedgerBulkBar";
import type { Order } from "@/types/order";

const order = (id: string, over: Partial<Order> = {}): Order => ({
  id,
  orderNumber: Number(id.replace(/\D/g, "")) || undefined,
  source: "phone",
  locale: "es",
  lines: [],
  fulfillment: { method: "pickup", recipient: { name: "Ana", phone: "5165550100" }, window: { date: "2026-10-16", slot: "midday" } },
  contact: { phone: "5165550100" },
  totals: { subtotalCents: 0, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 0 },
  status: "out-for-delivery",
  paymentStatus: "pending",
  createdAt: "2026-10-15T15:00:00Z",
  updatedAt: "2026-10-15T15:00:00Z",
  ...over,
});

let fetchMock: MockInstance<typeof fetch>;
beforeEach(() => {
  vi.restoreAllMocks();
  fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
});

describe("LedgerBulkBar", () => {
  it("marks the eligible orders delivered after confirming, and reports the rest", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const onDone = vi.fn();
    render(
      <LedgerBulkBar
        selected={[order("o1001"), order("o1002"), order("o1003", { status: "delivered" })]}
        locale="es"
        onDone={onDone}
        onClear={() => {}}
      />,
    );
    expect(screen.getByText(/bulk_selected .*"count":3/)).toBeDefined();
    fireEvent.change(screen.getByLabelText("bulk_status"), { target: { value: "delivered" } });

    expect(confirm.mock.calls[0][0]).toMatch(/bulk_confirm_status .*"count":2/);
    expect(confirm.mock.calls[0][0]).toMatch(/bulk_confirm_sms/);
    expect(confirm.mock.calls[0][0]).toMatch(/#1003/);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls).toEqual(["/api/admin/orders/o1001/fulfillment", "/api/admin/orders/o1002/fulfillment"]);
    expect(screen.getByRole("status").textContent).toMatch(/bulk_result .*"done":2/);
  });

  it("does nothing when staff cancel the confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<LedgerBulkBar selected={[order("o1")]} locale="es" onDone={() => {}} onClear={() => {}} />);
    fireEvent.change(screen.getByLabelText("bulk_paid"), { target: { value: "cash" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names the orders that failed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "on_account" }), { status: 409 }));
    render(<LedgerBulkBar selected={[order("o1001")]} locale="es" onDone={() => {}} onClear={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "bulk_print" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/bulk_failed .*#1001 \(on_account\)/));
  });
});
