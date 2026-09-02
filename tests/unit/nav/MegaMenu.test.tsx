import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MegaMenu } from "@/components/nav/MegaMenu";

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
vi.mock("@/components/motion/BloomImage", () => ({
  BloomImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function open() {
  render(<MegaMenu locale="es" label="Tienda" />);
  return userEvent.hover(screen.getByRole("link", { name: "Tienda" }));
}

describe("MegaMenu", () => {
  it("stays closed until the shopper reaches for it", () => {
    render(<MegaMenu locale="es" label="Tienda" />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("offers gift cards — the studio sells them, so they cannot live only in the footer", async () => {
    await open();
    expect(screen.getByRole("menuitem", { name: /tarjetas de regalo/i })).toHaveAttribute(
      "href",
      "/es/gift-cards",
    );
  });

  it("lists the product categories", async () => {
    await open();
    expect(screen.getByRole("menuitem", { name: /arreglos/i })).toHaveAttribute(
      "href",
      "/es/shop/arrangements",
    );
  });

  it("lists occasions, pointing at their own pages and not a query string", async () => {
    await open();
    const birthday = screen.getByRole("menuitem", { name: /cumpleaños/i });
    expect(birthday).toHaveAttribute("href", "/es/ocasiones/birthday");
  });

  it("keeps the locale on every link it offers", async () => {
    await open();
    for (const item of screen.getAllByRole("menuitem")) {
      expect(item.getAttribute("href")).toMatch(/^\/es\//);
    }
  });
});
