import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PendingCard from "@/components/admin/dashboard/PendingCard";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));

const baseOrder = {
  id: "do_xyz", source: "walk-in", locale: "es",
  fulfillment: { method: "delivery", recipient: { name: "Maria Lopez", phone: "5165550100" },
    address: { street1: "1 A", city: "Great Neck", state: "NY", zip: "11020", country: "US" },
    window: { date: "2026-05-25", slot: "afternoon" } },
  contact: { phone: "5165550100" },
  totals: { subtotalCents: 18000, deliveryCents: 2500, taxCents: 1640, totalCents: 22140 },
  lines: [], status: "pending", paymentStatus: "paid",
  createdAt: "2026-05-25T08:00:00Z", updatedAt: "2026-05-25T08:00:00Z",
};

it("renders WEB badge + customer + total", () => {
  render(<PendingCard order={{ ...baseOrder, source: "web" } as never} reason="web_unacknowledged" onAction={() => {}} onOpen={() => {}} />);
  expect(screen.getByText("WEB")).toBeInTheDocument();
  expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
  expect(screen.getByText("$221.40")).toBeInTheDocument();
});

it("shows correct buttons for intake_unpaid_stale", () => {
  render(<PendingCard order={baseOrder as never} reason="intake_unpaid_stale" onAction={() => {}} onOpen={() => {}} />);
  expect(screen.getByRole("button", { name: /WhatsApp/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /action_resend_link/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /action_mark_paid/i })).toBeInTheDocument();
});

it("shows correct buttons for delivery_today_undispatched", () => {
  render(<PendingCard order={baseOrder as never} reason="delivery_today_undispatched" onAction={() => {}} onOpen={() => {}} />);
  expect(screen.getByRole("button", { name: /action_prepare/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /action_en_route/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /action_delivered/i })).toBeInTheDocument();
});

it("calls onOpen when clicking the card body", () => {
  const onOpen = vi.fn();
  render(<PendingCard order={baseOrder as never} reason="web_unacknowledged" onAction={() => {}} onOpen={onOpen} />);
  fireEvent.click(screen.getByTestId("pending-card-body"));
  expect(onOpen).toHaveBeenCalledWith("do_xyz");
});

it("calls onAction with the action id when clicking a button", () => {
  const onAction = vi.fn();
  render(<PendingCard order={baseOrder as never} reason="intake_unpaid_stale" onAction={onAction} onOpen={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /action_mark_paid/i }));
  expect(onAction).toHaveBeenCalledWith("do_xyz", "mark_paid");
});
