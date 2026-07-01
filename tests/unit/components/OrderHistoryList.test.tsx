import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import OrderHistoryList from "@/components/admin/dashboard/OrderHistoryList";
import type { OrderChange } from "@/types/order";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));

const history: OrderChange[] = [
  { id: "1", orderId: "o", at: "2026-06-01T10:00:00Z", actor: "maky", kind: "created", summary: "Orden creada · walk-in" },
  { id: "2", orderId: "o", at: "2026-06-01T11:00:00Z", actor: "maky", kind: "edit", summary: "Editó: Total",
    changes: [{ field: "totals.totalCents", label: "Total", before: "$50.00", after: "$60.00" }] },
];

describe("OrderHistoryList", () => {
  it("renders entries newest-first with edit diffs", () => {
    render(<OrderHistoryList history={history} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("Editó: Total");
    expect(screen.getByText(/\$50\.00/)).toBeInTheDocument();
    expect(screen.getByText(/\$60\.00/)).toBeInTheDocument();
  });

  it("renders an empty state", () => {
    render(<OrderHistoryList history={[]} />);
    expect(screen.getByText(/no_changes/)).toBeInTheDocument();
  });
});
