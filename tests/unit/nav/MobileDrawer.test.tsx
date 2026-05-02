import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileDrawer } from "@/components/nav/MobileDrawer";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...p}>{children}</a>
  ),
}));

vi.mock("@/components/nav/LocaleSwitcher", () => ({
  LocaleSwitcher: ({ current }: { current: string }) => <span data-testid="locale-switcher">{current}</span>,
}));

vi.mock("@/components/nav/CartButton", () => ({
  CartButton: ({ locale }: { locale: string }) => <button data-testid="cart-button">{locale}</button>,
}));

describe("MobileDrawer", () => {
  it("is not rendered when isOpen is false", () => {
    render(<MobileDrawer isOpen={false} onClose={vi.fn()} locale="en" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with nav links when isOpen is true", () => {
    render(<MobileDrawer isOpen={true} onClose={vi.fn()} locale="en" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /shop/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /weddings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /events/i })).toBeInTheDocument();
  });

  it("renders category chips when open", () => {
    render(<MobileDrawer isOpen={true} onClose={vi.fn()} locale="en" />);
    expect(screen.getByRole("link", { name: /arrangements/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bouquets/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<MobileDrawer isOpen={true} onClose={handler} locale="en" />);
    await user.click(screen.getByRole("button", { name: "close_menu" }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("calls onClose when overlay is clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<MobileDrawer isOpen={true} onClose={handler} locale="en" />);
    await user.click(screen.getByTestId("drawer-overlay"));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("calls onClose when a nav link is clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<MobileDrawer isOpen={true} onClose={handler} locale="en" />);
    await user.click(screen.getByRole("link", { name: /weddings/i }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it("renders es labels for locale=es", () => {
    render(<MobileDrawer isOpen={true} onClose={vi.fn()} locale="es" />);
    expect(screen.getByRole("link", { name: /arreglos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ramos/i })).toBeInTheDocument();
  });

  it("calls onClose when Escape key is pressed", async () => {
    const handler = vi.fn();
    render(<MobileDrawer isOpen={true} onClose={handler} locale="en" />);
    await userEvent.keyboard("{Escape}");
    expect(handler).toHaveBeenCalledOnce();
  });
});
