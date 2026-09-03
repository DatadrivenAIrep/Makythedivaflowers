import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PromosView from "@/components/admin/promos/PromosView";
import type { PromoListItem } from "@/lib/promo";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ promos: [] }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const promo = (over: Partial<PromoListItem> = {}): PromoListItem => ({
  id: "promo_1",
  code: "WELCOME10",
  kind: "percent",
  value: 10,
  firstOrderOnly: false,
  active: true,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  redemptionCount: 0,
  discountedCents: 0,
  ...over,
});

describe("PromosView", () => {
  it("lists a code with its usage and money discounted", () => {
    render(
      <PromosView
        initialPromos={[promo({ redemptionCount: 3, discountedCents: 6000 })]}
        locale="en"
      />,
    );
    const row = screen.getByText("WELCOME10").closest("tr")!;
    expect(within(row).getByText("10%")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("$60")).toBeInTheDocument();
  });

  it("spells out the rules attached to a code", () => {
    render(
      <PromosView
        initialPromos={[
          promo({ minSubtotalCents: 7500, maxRedemptions: 50, firstOrderOnly: true }),
        ]}
        locale="en"
      />,
    );
    const row = screen.getByText("WELCOME10").closest("tr")!;
    expect(row.textContent).toContain("$75");
    expect(row.textContent).toContain("50");
    expect(row.textContent).toContain("rule_first_order");
  });

  it("shows a fixed-amount code in dollars, not cents", () => {
    render(<PromosView initialPromos={[promo({ kind: "fixed", value: 2000 })]} locale="en" />);
    // 2000 cents must read as $20, never as "2000".
    expect(screen.getByText("$20")).toBeInTheDocument();
    expect(screen.queryByText("2000")).not.toBeInTheDocument();
  });

  it("deactivates a code through the API", async () => {
    const user = userEvent.setup();
    render(<PromosView initialPromos={[promo()]} locale="en" />);
    await user.click(screen.getByRole("button", { name: "status_active" }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/promos/promo_1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ active: false });
  });

  it("sends a percent code as a whole number and a fixed code in cents", async () => {
    const user = userEvent.setup();
    render(<PromosView initialPromos={[]} locale="en" />);

    await user.type(screen.getByLabelText("field_code"), "SAVE20");
    await user.selectOptions(screen.getByLabelText("field_kind"), "fixed");
    const amount = screen.getByLabelText("field_amount");
    await user.clear(amount);
    await user.type(amount, "20");
    await user.type(screen.getByLabelText("field_min_subtotal"), "75");
    await user.click(screen.getByRole("button", { name: "create_cta" }));

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toMatchObject({
      code: "SAVE20",
      kind: "fixed",
      value: 2000,
      minSubtotalCents: 7500,
    });
  });

  it("tells the owner when the code already exists", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ errors: { formErrors: ["duplicate_code"] } }),
    });
    render(<PromosView initialPromos={[]} locale="en" />);

    await user.type(screen.getByLabelText("field_code"), "DUP");
    await user.click(screen.getByRole("button", { name: "create_cta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("error_duplicate");
  });

  it("shows an empty state when there are no codes", () => {
    render(<PromosView initialPromos={[]} locale="en" />);
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
});
