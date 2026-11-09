import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";

vi.setConfig({ testTimeout: 30000 });

const { push, cartState, uiState, stripeMock } = vi.hoisted(() => ({
  push: vi.fn(),
  cartState: {
    // $250.00 standard, so 15% and a $37.50 code are the same discount.
    lines: [
      { kind: "catalog" as const, productId: "p-arr-m01", variantId: "standard", addOnIds: [] as string[], qty: 1 },
    ],
    clear: vi.fn(),
    cardMessage: "",
  },
  uiState: { closeDrawer: vi.fn() },
  stripeMock: { confirmPayment: vi.fn(async () => ({})) },
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
vi.mock("@stripe/react-stripe-js", async () => {
  const React = await import("react");
  return {
    Elements: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    PaymentElement: () => React.createElement("div", { "data-testid": "payment-element" }),
    useStripe: () => stripeMock,
    useElements: () => stripeMock,
  };
});
vi.mock("framer-motion", async () => {
  const React = await import("react");
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

const REWARDS = [
  { id: "r15", percent: 15, label: "15% off" },
  { id: "r5", percent: 5, label: "5% off" },
];

type IntentBody = {
  orderId?: string;
  promoCode?: string;
  loyaltyRewardId?: string;
  loyaltyProof?: string;
  tipCents?: number;
  form: { joinLoyaltyCard?: boolean; contact: { phone: string } };
};

function reply(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);
}
const refused = (code: string) => reply({ errors: { formErrors: [code] } }, 400);

const fetchMock = vi.fn();
let intents: IntentBody[] = [];
let sends = 0;
let lookup: () => unknown = () => ({ status: "no_card" });
let onIntent: (n: number, body: IntentBody) => Promise<Response> | null = () => null;

beforeEach(() => {
  intents = [];
  sends = 0;
  lookup = () => ({ status: "no_card" });
  onIntent = () => null;
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init: { body: string }) => {
    const body = JSON.parse(init.body);
    switch (url) {
      case "/api/checkout/intent": {
        intents.push(body);
        const n = intents.length;
        return onIntent(n, body) ?? reply({ clientSecret: `cs_${n}`, orderId: "do_1" });
      }
      case "/api/checkout/loyalty/lookup":
        return reply(lookup());
      case "/api/checkout/loyalty/send-code":
        sends += 1;
        return reply({ sent: true });
      case "/api/checkout/loyalty/verify":
        return reply({ proof: "P1", rewards: REWARDS });
      case "/api/checkout/promo":
        return reply({ valid: true, code: "FIJO", discountCents: 3750 });
      default:
        throw new Error(`unexpected fetch ${url}`);
    }
  });
  vi.stubGlobal("fetch", fetchMock);
  try { sessionStorage.clear(); } catch { /* jsdom without storage */ }
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;

function field(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no field #${id} in the document`);
  return el;
}
const header = (n: 1 | 2 | 3) =>
  screen.getByRole("button", { name: `${n}. ${{ 1: "step_contact", 2: "step_delivery", 3: "step_payment" }[n]}` });
const continueBtn = () => screen.getByRole("button", { name: "continue" });

async function fillContact(user: User, phone = "5165551234") {
  await user.type(field("ck-name"), "Robyn Buyer");
  await user.type(field("ck-email"), "buyer@example.com");
  await user.type(field("ck-phone"), phone);
}

async function fillDelivery(user: User) {
  await user.click(await screen.findByText("fulfillment_pickup"));
  await user.type(field("ck-rname"), "Nisha");
  await user.type(field("ck-rphone"), "5165550100");
  fireEvent.change(field("ck-date"), { target: { value: "2099-01-01" } });
}

async function toPayment(user: User) {
  await user.click(continueBtn());
  await fillDelivery(user);
  await user.click(continueBtn());
  expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
}

async function applyRewardBySms(user: User) {
  await user.click(await screen.findByRole("button", { name: "loyalty_use" }, { timeout: 3000 }));
  await user.type(await screen.findByLabelText("loyalty_code_label"), "123456");
  await user.click(screen.getByRole("button", { name: "loyalty_confirm" }));
  await screen.findByText("loyalty_applied");
}

async function replacePhone(user: User, phone: string) {
  await user.clear(field("ck-phone"));
  await user.type(field("ck-phone"), phone);
}

async function applyPromo(user: User) {
  await user.type(screen.getByLabelText("promo.label"), "FIJO");
  await user.click(screen.getByRole("button", { name: "promo.apply" }));
  await screen.findByText("FIJO");
}

function withCard() {
  lookup = () => ({ status: "card", rewards: REWARDS });
}

describe("CheckoutShell keeps the order in step with the form", () => {
  it("sends the reward id and proof, and no promo code, when creating the intent", async () => {
    const user = userEvent.setup();
    withCard();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await toPayment(user);

    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ loyaltyRewardId: "r15", loyaltyProof: "P1" });
    expect(intents[0].promoCode).toBeUndefined();
    expect(intents[0].form.contact.phone).toBe("5165551234");
    // Never a price from the browser.
    expect(JSON.stringify(intents[0])).not.toMatch(/discount|percent/i);
  });

  it("re-creates the intent with joinLoyaltyCard false after the box is unticked", async () => {
    const user = userEvent.setup();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await user.click(await screen.findByLabelText("join_card_label", {}, { timeout: 3000 }));
    await toPayment(user);
    expect(intents[0].form.joinLoyaltyCard).toBe(true);

    await user.click(header(1));
    await user.click(await screen.findByLabelText("join_card_label"));
    await user.click(header(3));

    await waitFor(() => expect(intents).toHaveLength(2));
    expect(intents[1].form.joinLoyaltyCard).toBe(false);
    expect(intents[1].orderId).toBe("do_1");
    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
  });

  it("re-creates the intent with the corrected phone", async () => {
    const user = userEvent.setup();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await toPayment(user);

    await user.click(header(1));
    await replacePhone(user, "5165559999");
    await user.click(header(3));

    await waitFor(() => expect(intents).toHaveLength(2));
    expect(intents[1].form.contact.phone).toBe("5165559999");
    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
  });

  it("does not open payment with a phone that fails validation", async () => {
    const user = userEvent.setup();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await toPayment(user);

    await user.click(header(1));
    await user.clear(field("ck-phone"));
    await user.click(header(3));

    await waitFor(() => expect(field("ck-phone")).toHaveAttribute("aria-invalid", "true"));
    expect(intents).toHaveLength(1);
    expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
  });

  it("does not re-create the intent when the payment header is clicked while open", async () => {
    const user = userEvent.setup();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await toPayment(user);

    await user.click(header(3));
    await new Promise((r) => setTimeout(r, 100));
    expect(intents).toHaveLength(1);
  });

  it("the Enter key outside the payment step cannot pay the old intent", async () => {
    const user = userEvent.setup();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await toPayment(user);

    await user.click(header(1));
    fireEvent.submit(field("ck-phone").closest("form")!);
    await new Promise((r) => setTimeout(r, 50));
    expect(stripeMock.confirmPayment).not.toHaveBeenCalled();
  });

  it("re-creates the intent when a promo replaces a reward of the same value", async () => {
    const user = userEvent.setup();
    withCard();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await toPayment(user);

    await applyPromo(user);

    await waitFor(() => expect(intents).toHaveLength(2));
    expect(intents[1].promoCode).toBe("FIJO");
    expect(intents[1].loyaltyRewardId).toBeUndefined();
    expect(intents[1].loyaltyProof).toBeUndefined();
  });

  it("re-creates the intent when a reward replaces a promo of the same value", async () => {
    const user = userEvent.setup();
    withCard();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await toPayment(user);
    await applyPromo(user);
    await waitFor(() => expect(intents).toHaveLength(2));

    await user.click(header(1));
    await applyRewardBySms(user);

    await waitFor(() => expect(intents).toHaveLength(3));
    expect(intents[2].loyaltyRewardId).toBe("r15");
    expect(intents[2].promoCode).toBeUndefined();

    // Applying the reward emptied the promo field.
    await user.click(header(3));
    expect(await screen.findByLabelText("promo.label")).toHaveValue("");
    expect(screen.queryByText("FIJO")).not.toBeInTheDocument();
  });
});

describe("the buyer sees why a reward was refused", () => {
  it("keeps the message in the payment step through the re-price", async () => {
    const user = userEvent.setup();
    withCard();
    onIntent = (n) => (n === 2 ? refused("loyalty_reward_unavailable") : null);
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await toPayment(user);
    expect(screen.getByText("Discount")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "$10" }));

    await waitFor(() => expect(intents).toHaveLength(3));
    expect(intents[2].loyaltyRewardId).toBeUndefined();
    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
    expect(screen.getAllByText("loyalty_unavailable")).toHaveLength(1);
    expect(screen.queryByText("Discount")).not.toBeInTheDocument();
  });

  it("shows the message in the delivery step when Continue is refused", async () => {
    const user = userEvent.setup();
    withCard();
    onIntent = (n) => (n === 1 ? refused("loyalty_proof_invalid") : null);
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await user.click(continueBtn());
    await fillDelivery(user);
    await user.click(continueBtn());

    expect(await screen.findByText("loyalty_unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Discount")).not.toBeInTheDocument();

    // Continuing without the reward shows it once, not again as a payment error.
    await user.click(continueBtn());
    expect(await screen.findByTestId("payment-element")).toBeInTheDocument();
    expect(intents[1].loyaltyRewardId).toBeUndefined();
    expect(screen.getAllByText("loyalty_unavailable")).toHaveLength(1);
  });

  it("clears the message when the phone changes", async () => {
    const user = userEvent.setup();
    withCard();
    onIntent = (n) => (n === 1 ? refused("loyalty_reward_unavailable") : null);
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await user.click(continueBtn());
    await fillDelivery(user);
    await user.click(continueBtn());
    await screen.findByText("loyalty_unavailable");

    await user.click(header(1));
    expect(screen.getByText("loyalty_unavailable")).toBeInTheDocument();
    await replacePhone(user, "5165559999");
    expect(screen.queryByText("loyalty_unavailable")).not.toBeInTheDocument();
  });

  it("clears the message on the next apply", async () => {
    const user = userEvent.setup();
    withCard();
    onIntent = (n) => (n === 2 ? refused("loyalty_reward_unavailable") : null);
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await toPayment(user);
    await user.click(screen.getByRole("button", { name: "$10" }));
    await waitFor(() => expect(intents).toHaveLength(3));
    await screen.findByText("loyalty_unavailable");

    await applyPromo(user);
    expect(screen.queryByText("loyalty_unavailable")).not.toBeInTheDocument();
  });
});

describe("switching rewards does not ask for another SMS", () => {
  async function removeAndPickOther(user: User) {
    await user.click(await screen.findByRole("button", { name: "loyalty_remove" }));
    await user.click(await screen.findByRole("radio", { name: "5% off" }, { timeout: 3000 }));
    await user.click(screen.getByRole("button", { name: "loyalty_use" }));
  }

  it("verify once, remove, pick another: one send-code and the same proof", async () => {
    const user = userEvent.setup();
    withCard();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);

    await removeAndPickOther(user);

    await screen.findByText("5% off");
    expect(sends).toBe(1);
    await toPayment(user);
    expect(intents[0]).toMatchObject({ loyaltyRewardId: "r5", loyaltyProof: "P1" });
  });

  it("the proof survives the contact step collapsing", async () => {
    const user = userEvent.setup();
    withCard();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await user.click(continueBtn());
    await screen.findByText("fulfillment_pickup");

    await user.click(header(1));
    await removeAndPickOther(user);

    await screen.findByText("5% off");
    expect(sends).toBe(1);
  });

  it("a phone change drops the proof", async () => {
    const user = userEvent.setup();
    withCard();
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);

    await replacePhone(user, "5165559999");
    await waitFor(() => expect(screen.queryByText("loyalty_applied")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("button", { name: "loyalty_use" }, { timeout: 3000 }));

    await waitFor(() => expect(sends).toBe(2));
    expect(await screen.findByLabelText("loyalty_code_label")).toBeInTheDocument();
  });

  it("a refused proof goes back to the code flow", async () => {
    const user = userEvent.setup();
    withCard();
    onIntent = (n) => (n === 2 ? refused("loyalty_proof_invalid") : null);
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await toPayment(user);
    await user.click(screen.getByRole("button", { name: "$10" }));
    await waitFor(() => expect(intents).toHaveLength(3));

    await user.click(header(1));
    await user.click(await screen.findByRole("button", { name: "loyalty_use" }, { timeout: 3000 }));

    await waitFor(() => expect(sends).toBe(2));
  });

  it("a spent reward keeps the proof for the others", async () => {
    const user = userEvent.setup();
    withCard();
    onIntent = (n) => (n === 2 ? refused("loyalty_reward_unavailable") : null);
    render(<CheckoutShell locale="en" />);
    await fillContact(user);
    await applyRewardBySms(user);
    await toPayment(user);
    await user.click(screen.getByRole("button", { name: "$10" }));
    await waitFor(() => expect(intents).toHaveLength(3));

    await user.click(header(1));
    await user.click(await screen.findByRole("radio", { name: "5% off" }, { timeout: 3000 }));
    await user.click(screen.getByRole("button", { name: "loyalty_use" }));

    await screen.findByText("5% off");
    expect(sends).toBe(1);
  });
});
