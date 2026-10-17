import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string, v?: Record<string, unknown>) => (v ? `${k} ${JSON.stringify(v)}` : k),
  useLocale: () => "es",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("day=2026-10-16"),
  usePathname: () => "/es/admin/dashboard/cierre",
}));
// The shell polls unread SMS and renders the logo; none of that is under test here.
vi.mock("@/components/admin/dashboard/DashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import CashCloseView from "@/components/admin/dashboard/CashCloseView";

const summary = {
  byMethod: { cash: 36500, zelle: 0, "card-terminal": 12000, ach: 0, check: 0, stripe: 0, unknown: 0 },
  cashInCents: 38500,
  cashRefundsCents: 2000,
  giftCardRedeemedCents: 0,
  totalCollectedCents: 48500,
};

const getBody = {
  day: "2026-10-16",
  firstDay: "2026-10-01",
  payments: [
    { id: "p1", at: "2026-10-16T14:05:00.000Z", day: "2026-10-16", kind: "payment", method: "cash", amountCents: 38500, source: "intake", actor: "maky", orderNumber: 1201, customerName: "Ana" },
    { id: "p2", at: "2026-10-16T15:00:00.000Z", day: "2026-10-16", kind: "refund", method: "cash", amountCents: -2000, source: "cancel_refund", actor: "maky" },
    { id: "p3", at: "2026-10-16T16:00:00.000Z", day: "2026-10-16", kind: "payment", method: "card-terminal", amountCents: 12000, source: "mark_paid", actor: "maky" },
  ],
  summary,
  close: null,
  changeSinceCloseCents: 0,
  previousFloatCents: 10000,
  sales: { orders: 3, subtotalCents: 40000, taxCents: 3450, tipCents: 0, deliveryCents: 1500, discountCents: 0, pendingCents: 0 },
  history: [],
};

let putBodies: Record<string, unknown>[] = [];

beforeEach(() => {
  putBodies = [];
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    if (init?.method === "PUT") {
      putBodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ close: { updatedAt: "2026-10-16T22:30:00.000Z" } }), { status: 200 });
    }
    return new Response(JSON.stringify(getBody), { status: 200 });
  });
});

describe("CashCloseView", () => {
  it("computes the expected cash and the difference live, and saves the typed fields", async () => {
    render(<CashCloseView locale="es" />);
    const out = await screen.findByLabelText("cash_out");
    fireEvent.change(out, { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("counted"), { target: { value: "448" } });

    // 100.00 float + 385.00 cash in - 20.00 refunds - 12.00 out
    expect(within(screen.getByTestId("expected-row")).getByText("$453.00")).toBeDefined();
    const diff = screen.getByTestId("difference-row");
    expect(within(diff).getByText("-$5.00")).toBeDefined();
    expect(within(diff).getByText("short")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "save" }));
    await waitFor(() => expect(putBodies).toHaveLength(1));
    expect(putBodies[0]).toMatchObject({
      day: "2026-10-16",
      openingFloatCents: 10000,
      cashOutCents: 1200,
      countedCents: 44800,
      floatLeftCents: 10000,
      reviewed: [],
    });
    expect(await screen.findByText(/saved/)).toBeDefined();
  });

  it("disables save while a typed amount is not a number", async () => {
    render(<CashCloseView locale="es" />);
    const counted = await screen.findByLabelText("counted");
    fireEvent.change(counted, { target: { value: "448" } });
    const save = screen.getByRole("button", { name: "save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.change(counted, { target: { value: "abc" } });
    expect(save.disabled).toBe(true);
    expect(screen.getByText("invalid_amount")).toBeDefined();
  });
});
