import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useCartStore } from "@/lib/cart-store";
import { PRODUCTS } from "@/data/products";
import { CartUpsellStrip } from "@/components/conversion/CartUpsellStrip";
import { DigitalCardOffer, LONG_MESSAGE_CHARS } from "@/components/product/DigitalCardOffer";
import { DIGITAL_CARD_ID } from "@/lib/digital-card-offer";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const celebration = PRODUCTS.find((p) => p.id === "p-arr-m01")!; // anniversary / romance
const sympathy = PRODUCTS.find((p) => p.category === "sympathy" && p.occasions.every((o) => o === "sympathy"))!;
const line = (productId: string, addOnIds: string[] = []) => ({
  kind: "catalog" as const, productId, variantId: PRODUCTS.find((p) => p.id === productId)!.variants[0].id, addOnIds, qty: 1,
});

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  useCartStore.setState({ lines: [], cardMessage: "" });
});

describe("CartUpsellStrip digital card", () => {
  it("offers the digital card as its own card, not as a chip, on a celebration bouquet", () => {
    useCartStore.setState({ lines: [line(celebration.id)] });
    render(<CartUpsellStrip locale="es" />);
    expect(screen.getByTestId("cart-digital-card")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tarjeta digital/ })).toBeNull();
  });

  it("adds the digital card to the cart in one tap", () => {
    useCartStore.setState({ lines: [line(celebration.id)] });
    render(<CartUpsellStrip locale="es" />);
    fireEvent.click(screen.getByRole("button", { name: "digital_add_aria" }));
    expect(useCartStore.getState().lines.some((l) => l.kind === "catalog" && l.productId === DIGITAL_CARD_ID)).toBe(true);
    expect(screen.getByText(/digital_added/)).toBeInTheDocument();
  });

  it("is not offered when the bouquet already carries it", () => {
    useCartStore.setState({ lines: [line(celebration.id, [DIGITAL_CARD_ID])] });
    render(<CartUpsellStrip locale="es" />);
    expect(screen.queryByTestId("cart-digital-card")).toBeNull();
  });

  it("is not offered on a sympathy-only cart", () => {
    useCartStore.setState({ lines: [line(sympathy.id)] });
    render(<CartUpsellStrip locale="es" />);
    expect(screen.queryByTestId("cart-digital-card")).toBeNull();
  });
});

describe("DigitalCardOffer long-message nudge", () => {
  const props = { product: celebration, locale: "es" as const, value: [] as string[], onChange: () => {} };

  it("keeps the usual copy for a short message", () => {
    render(<DigitalCardOffer {...props} message="Feliz aniversario" />);
    expect(screen.queryByText(/Mucho que decir/)).toBeNull();
  });

  it("turns to 'your whole letter fits' once the message is long", () => {
    render(<DigitalCardOffer {...props} message={"a".repeat(LONG_MESSAGE_CHARS)} />);
    expect(screen.getByText(/Mucho que decir/)).toBeInTheDocument();
  });

  it("does not nudge once the card is already added", () => {
    render(<DigitalCardOffer {...props} value={[DIGITAL_CARD_ID]} message={"a".repeat(LONG_MESSAGE_CHARS)} />);
    expect(screen.queryByText(/Mucho que decir/)).toBeNull();
  });
});
