import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/es/admin/dashboard" }));
vi.mock("@/components/nav/LocaleSwitcher", () => ({ LocaleSwitcher: () => <button>EN · ES</button> }));

describe("DashboardShell", () => {
  it("renders translated nav keys + the locale toggle", () => {
    render(<DashboardShell locale="es"><div>content</div></DashboardShell>);
    expect(screen.getByText("nav_bandeja")).toBeInTheDocument();
    expect(screen.getByText("nav_ledger")).toBeInTheDocument();
    expect(screen.getByText("EN · ES")).toBeInTheDocument();
  });

  it("badges the Mensajes tab with the unread SMS count", () => {
    render(<DashboardShell locale="es" smsUnread={3}><div /></DashboardShell>);
    expect(screen.getByLabelText('sms_unread_badge:{"count":3}')).toHaveTextContent("3");
  });

  it("shows no badge when every SMS is read", () => {
    render(<DashboardShell locale="es" smsUnread={0}><div /></DashboardShell>);
    expect(screen.queryByLabelText(/sms_unread_badge/)).toBeNull();
  });

  it("marks the current section so the tab row can keep it in view", () => {
    render(<DashboardShell locale="es"><div>content</div></DashboardShell>);
    expect(screen.getByText("nav_bandeja")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("nav_accounts")).not.toHaveAttribute("aria-current");
  });

  it("pins new order outside the scrolling tab row", () => {
    render(<DashboardShell locale="es"><div>content</div></DashboardShell>);
    const newOrder = screen.getByRole("link", { name: "nav_new_order" });
    expect(newOrder).toHaveAttribute("href", "/es/admin/intake");
    expect(screen.getByRole("navigation")).not.toContainElement(newOrder);
  });

  it("names the refresh button even when its label is hidden on phones", () => {
    render(<DashboardShell locale="es" onRefresh={() => {}}><div>content</div></DashboardShell>);
    expect(screen.getByRole("button", { name: "refresh" })).toBeInTheDocument();
  });
});
