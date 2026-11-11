// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/components/admin/dashboard/DashboardShell", () => ({ default: () => null }));
vi.mock("@/components/admin/occasions/OccasionsView", () => ({ default: () => null }));
vi.mock("@/components/admin/occasions/CardDatesPanel", () => ({ default: () => null }));
vi.mock("@/components/admin/occasions/DateResults", () => ({ default: () => null }));
vi.mock("@/lib/date-results", () => ({ dateResults: () => null }));
vi.mock("@/lib/date-rewards-flags", () => ({ dateRewardsEnabled: () => false }));
vi.mock("@/lib/customer-dates-storage", () => ({ listUpcomingOccasions: () => [] }));
vi.mock("@/lib/card-dates-scan", () => ({
  previewCardScan: () => {
    throw new SyntaxError('Unexpected token "Rosa Perez"');
  },
  listCardReviews: () => [],
}));

import AdminOccasionsPage from "@/app/[locale]/admin/occasions/page";
import CardDatesPanel from "@/components/admin/occasions/CardDatesPanel";
import OccasionsView from "@/components/admin/occasions/OccasionsView";

afterEach(() => vi.restoreAllMocks());

type El = { type: unknown; props: { children?: El | El[] | false | null } };
const kids = (tree: El): unknown[] => {
  const c = tree.props.children;
  return (Array.isArray(c) ? c : [c]).filter(Boolean).map((x) => (x as El).type);
};

describe("admin occasions page", () => {
  it("still renders the occasions, without the card panel, when the card scan fails", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const tree = (await AdminOccasionsPage({ params: Promise.resolve({ locale: "es" }) })) as unknown as El;
    const types = kids(tree);
    expect(types).toContain(OccasionsView);
    expect(types).not.toContain(CardDatesPanel);
    const line = String(err.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({ event: "card_dates_page_failed", error: "SyntaxError" });
    expect(line).not.toContain("Rosa");
  });
});
