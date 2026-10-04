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
});
