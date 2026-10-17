import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ReceivablesSection from "@/components/admin/dashboard/ReceivablesSection";
import OrderDetailDrawer from "@/components/admin/dashboard/OrderDetailDrawer";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));

afterEach(() => vi.restoreAllMocks());

type FetchCall = { url: string; init?: RequestInit };

describe("Por cobrar: saldar pide el método", () => {
  it("sends the picked method with settleBalance when the row can't get a reminder", async () => {
    const calls: FetchCall[] = [];
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/receivables")) {
        return Promise.resolve(new Response(JSON.stringify({
          totalCents: 5000,
          items: [{
            orderId: "o1", orderNumber: 12, buyerName: "Maria Lopez", phone: "5165550100",
            method: "pickup", dueDate: "2026-10-01", daysOverdue: 5, balanceCents: 5000, canRemind: false,
          }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    render(<ReceivablesSection locale="es" version={0} onOpen={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "action_mark_paid" }));
    fireEvent.click(await screen.findByRole("button", { name: "zelle" }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.init?.method === "PATCH")!;
    expect(patch.url).toBe("/api/admin/orders/o1/payment");
    expect(patch.init?.body).toBe(JSON.stringify({ settleBalance: true, method: "zelle" }));
  });

  it("offers a cheque when settling, like the order drawer", async () => {
    const calls: FetchCall[] = [];
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes("/receivables")) {
        return Promise.resolve(new Response(JSON.stringify({
          totalCents: 5000,
          items: [{
            orderId: "o2", orderNumber: 13, buyerName: "Ana Ruiz", phone: "5165550101",
            method: "pickup", dueDate: "2026-10-01", daysOverdue: 5, balanceCents: 5000, canRemind: false,
          }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    render(<ReceivablesSection locale="es" version={0} onOpen={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "action_mark_paid" }));
    fireEvent.click(await screen.findByRole("button", { name: "settle_method_check" }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.init?.method === "PATCH")!;
    expect(patch.init?.body).toBe(JSON.stringify({ settleBalance: true, method: "check" }));
  });

  it("does not offer a cheque when marking a pending order paid", async () => {
    vi.spyOn(global, "fetch").mockImplementation((input) => {
      if (String(input).includes("/receivables")) {
        return Promise.resolve(new Response(JSON.stringify({
          totalCents: 5000,
          items: [{
            orderId: "o3", orderNumber: 14, buyerName: "Luz Gil", phone: "5165550102",
            method: "pickup", dueDate: "2026-10-01", daysOverdue: 5, balanceCents: 5000, canRemind: true,
          }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    render(<ReceivablesSection locale="es" version={0} onOpen={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "action_mark_paid" }));
    expect(await screen.findByRole("button", { name: "cash" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "settle_method_check" })).toBeNull();
  });
});

describe("OrderDetailDrawer: Saldar pide el método", () => {
  it("reveals the five methods and PATCHes the picked one", async () => {
    const order = {
      id: "o9", source: "phone", locale: "es",
      fulfillment: { method: "pickup", recipient: { name: "Maria Lopez", phone: "5165550100" },
        window: { date: "2026-05-30", slot: "midday" } },
      contact: { phone: "5165550100" },
      totals: { subtotalCents: 10000, deliveryCents: 0, taxCents: 0, totalCents: 10000 },
      lines: [], status: "delivered", paymentStatus: "paid", amountPaidCents: 6000,
      createdAt: "2026-05-25T10:00:00Z", updatedAt: "2026-05-25T10:00:00Z",
    };
    const calls: FetchCall[] = [];
    vi.spyOn(global, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/o9") && !init?.method) {
        return Promise.resolve(new Response(JSON.stringify({ order, customer: null, messages: [], balanceCents: 4000 }), { status: 200 }));
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });
    render(<OrderDetailDrawer orderId="o9" onClose={() => {}} onChanged={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "mark_settled" }));
    expect(await screen.findByText("settle_method")).toBeInTheDocument();
    for (const m of ["cash", "zelle", "card-terminal", "ach", "check"]) {
      expect(screen.getByRole("button", { name: `settle_method_${m}` })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "settle_method_check" }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === "PATCH")).toBe(true));
    const patch = calls.find((c) => c.init?.method === "PATCH")!;
    expect(patch.url).toBe("/api/admin/orders/o9/payment");
    expect(patch.init?.body).toBe(JSON.stringify({ settleBalance: true, method: "check" }));
  });
});
