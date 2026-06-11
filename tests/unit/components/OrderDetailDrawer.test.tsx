import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import OrderDetailDrawer from "@/components/admin/dashboard/OrderDetailDrawer";

const order = {
  id: "o1", source: "web", locale: "es",
  fulfillment: { method: "delivery", recipient: { name: "Maria Lopez", phone: "5165550100" },
    address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2026-05-30", slot: "midday" },
    cardMessage: "Feliz cumple" },
  contact: { phone: "5165550100", email: "maria@example.com" },
  totals: { subtotalCents: 10000, deliveryCents: 1000, taxCents: 880, totalCents: 11880 },
  lines: [], status: "pending", paymentStatus: "pending",
  createdAt: "2026-05-25T10:00:00Z", updatedAt: "2026-05-25T10:00:00Z",
};

beforeEach(() => {
  vi.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/o1") && !url.includes("/ack")) {
      return Promise.resolve(new Response(JSON.stringify({ order, customer: null, messages: [] }), { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
});

it("fetches the order and renders the timeline + customer info", async () => {
  render(<OrderDetailDrawer orderId="o1" onClose={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getAllByText(/Maria Lopez/).length).toBeGreaterThan(0));
  expect(screen.getByText(/Feliz cumple/)).toBeInTheDocument();
  expect(screen.getByText(/Albertson/)).toBeInTheDocument();
  expect(screen.getByText(/\$118\.80/)).toBeInTheDocument();
});

it("calls /ack for unacknowledged web orders", async () => {
  render(<OrderDetailDrawer orderId="o1" onClose={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getAllByText(/Maria Lopez/).length).toBeGreaterThan(0));
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
  expect(calls.some((u) => u.endsWith("/o1/ack"))).toBe(true);
});

it("shows fulfillment-advance actions for an unpaid phone order", async () => {
  const phoneOrder = { ...order, id: "o2", source: "phone", status: "pending", paymentStatus: "pending" };
  vi.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/o2") && !url.includes("/ack")) {
      return Promise.resolve(new Response(JSON.stringify({ order: phoneOrder, customer: null, messages: [] }), { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  render(<OrderDetailDrawer orderId="o2" onClose={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getAllByText(/Maria Lopez/).length).toBeGreaterThan(0));
  // payment-collection actions stay available for the unpaid order…
  expect(screen.getByRole("button", { name: /Cash/ })).toBeInTheDocument();
  // …and fulfillment can be advanced even though it isn't paid yet.
  expect(screen.getByRole("button", { name: /Preparar/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Entregada/ })).toBeInTheDocument();
});

it("shows fulfillment-advance actions for an unpaid walk-in order", async () => {
  const walkInOrder = { ...order, id: "o3", source: "walk-in", status: "pending", paymentStatus: "pending" };
  vi.spyOn(global, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.endsWith("/o3") && !url.includes("/ack")) {
      return Promise.resolve(new Response(JSON.stringify({ order: walkInOrder, customer: null, messages: [] }), { status: 200 }));
    }
    return Promise.resolve(new Response("{}", { status: 200 }));
  });
  render(<OrderDetailDrawer orderId="o3" onClose={() => {}} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getAllByText(/Maria Lopez/).length).toBeGreaterThan(0));
  expect(screen.getByRole("button", { name: /Cash/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Preparar/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Entregada/ })).toBeInTheDocument();
});

it("closes on Esc", async () => {
  const onClose = vi.fn();
  render(<OrderDetailDrawer orderId="o1" onClose={onClose} onChanged={() => {}} />);
  await waitFor(() => expect(screen.getAllByText(/Maria Lopez/).length).toBeGreaterThan(0));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalled();
});
