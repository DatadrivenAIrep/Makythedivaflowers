import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";

const { push, cartState, uiState } = vi.hoisted(() => ({
  push: vi.fn(),
  cartState: {
    // A real catalog line ($191.00 standard) — `kind` matters: resolveCartLine
    // drops anything that isn't "catalog" and the cart would total $0.
    lines: [
      { kind: "catalog" as const, productId: "p-arr-m01", variantId: "standard", addOnIds: [] as string[], qty: 1 },
    ],
    clear: vi.fn(),
    cardMessage: "",
  },
  uiState: { closeDrawer: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "en",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/cart-store", () => ({
  useCartStore: (sel: (s: typeof cartState) => unknown) => sel(cartState),
}));
vi.mock("@/lib/ui-store", () => ({
  useUIStore: (sel: (s: typeof uiState) => unknown) => sel(uiState),
}));
vi.mock("@/lib/stripe-client", () => ({ getStripeClient: () => Promise.resolve(null) }));

// The real Payment Element needs a live Stripe key and a network round trip.
// A marker div is enough: this test cares only about whether it is mounted.
vi.mock("@stripe/react-stripe-js", async () => {
  const React = await import("react");
  return {
    Elements: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    PaymentElement: () => React.createElement("div", { "data-testid": "payment-element" }),
    useStripe: () => ({ confirmPayment: vi.fn() }),
    useElements: () => ({}),
  };
});

// Deterministic accordion: without this, an exiting section can linger in jsdom
// and duplicate the "continue" button.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  // Cache per tag: returning a fresh component from the proxy on every access
  // makes React treat each render as a new element type and remount the whole
  // subtree, which wipes the form inputs between keystrokes.
  const tags = new Map<string | symbol, React.ComponentType<{ children?: React.ReactNode }>>();
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useReducedMotion: () => true,
    motion: new Proxy({} as Record<string | symbol, unknown>, {
      get: (_target, tag) => {
        if (!tags.has(tag)) {
          tags.set(tag, ({ children }: { children?: React.ReactNode }) =>
            React.createElement("div", null, children),
          );
        }
        return tags.get(tag);
      },
    }),
  };
});

const fetchMock = vi.fn();
let intentSeq = 0;

beforeEach(() => {
  intentSeq = 0;
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => {
    intentSeq += 1;
    return Promise.resolve({
      ok: true,
      json: async () => ({ clientSecret: `cs_${intentSeq}`, orderId: `do_${intentSeq}` }),
    } as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

/** The form's own ids — stabler here than labels, which carry a required "*". */
function field(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no field #${id} in the document`);
  return el;
}

/** Walks the buyer to step 3 via pickup, which needs no address. */
async function reachPaymentStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field("ck-email"), "buyer@example.com");
  await user.type(field("ck-phone"), "5165551234");
  await user.click(screen.getByRole("button", { name: "continue" }));

  await user.click(await screen.findByText("fulfillment_pickup"));
  await user.type(field("ck-rname"), "Nisha");
  await user.type(field("ck-rphone"), "5165550100");
  fireEvent.change(field("ck-date"), { target: { value: "2099-01-01" } });
  await user.click(screen.getByRole("button", { name: "continue" }));

  expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
}

describe("CheckoutShell payment step", () => {
  it("keeps the card form usable after the buyer changes the tip", async () => {
    // Regression: the PaymentIntent sync effect used to list `intent` in its own
    // dependency array while calling setIntent inside it. The re-run's cleanup
    // cancelled the request it had just fired, so the result was dropped, the
    // state stayed "creating", and the card form never came back — buyers were
    // stranded on "loading" with an untouched PaymentIntent sitting in Stripe.
    const user = userEvent.setup();
    render(<CheckoutShell locale="en" />);
    await reachPaymentStep(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "$10" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
  });

  it("re-prices through several changes in a row", async () => {
    // Michelle toggled the tip four times and was stuck every time.
    const user = userEvent.setup();
    render(<CheckoutShell locale="en" />);
    await reachPaymentStep(user);

    await user.click(screen.getByRole("button", { name: "$10" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "none" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await user.click(screen.getByRole("button", { name: "$15" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
  });

  it("does not re-create the intent when the amount is unchanged", async () => {
    // Every intent writes an order row, so re-selecting the same tip must not
    // add another pending order to the ledger.
    const user = userEvent.setup();
    render(<CheckoutShell locale="en" />);
    await reachPaymentStep(user);

    await user.click(screen.getByRole("button", { name: "none" }));
    await new Promise((r) => setTimeout(r, 100));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("payment-element")).toBeInTheDocument();
  });
});
