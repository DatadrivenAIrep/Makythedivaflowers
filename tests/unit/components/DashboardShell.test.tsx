import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardShell from "@/components/admin/dashboard/DashboardShell";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("next/navigation", () => ({ usePathname: () => "/es/admin/dashboard" }));
vi.mock("@/components/nav/LocaleSwitcher", () => ({ LocaleSwitcher: () => <button>EN · ES</button> }));

describe("DashboardShell", () => {
  it("renders translated nav keys + the locale toggle", () => {
    render(<DashboardShell locale="es"><div>content</div></DashboardShell>);
    expect(screen.getByText("nav_bandeja")).toBeInTheDocument();
    expect(screen.getByText("nav_ledger")).toBeInTheDocument();
    expect(screen.getByText("EN · ES")).toBeInTheDocument();
  });
});
