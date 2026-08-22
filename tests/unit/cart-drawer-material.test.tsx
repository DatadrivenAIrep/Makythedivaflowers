import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
// open drawer via ui-store
import { useUIStore } from "@/lib/ui-store";
// cart-store: one line so it renders the list branch
vi.mock("@/lib/cart-store", () => ({
  useCartStore: (sel: (s: unknown) => unknown) =>
    sel({ lines: [], setQty: () => {}, remove: () => {} }),
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  useUIStore.setState({ drawerOpen: true });
});

import { CartDrawer } from "@/components/cart/CartDrawer";

describe("CartDrawer material", () => {
  it("renders a dialog with the material surface when open", () => {
    render(<CartDrawer locale="en" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toMatch(/material-bg|backdrop-filter/);
  });
});
