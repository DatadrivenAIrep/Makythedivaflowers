import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";
import { MagneticButton } from "@/components/motion/MagneticButton";

describe("Button", () => {
  it("gives instant press feedback and a graceful transform release", () => {
    render(<Button>Buy</Button>);
    const el = screen.getByRole("button", { name: "Buy" });
    expect(el.className).toContain("active:scale-[0.98]");
    // transform is transitioned (release settles), not only colors
    expect(el.className).toMatch(/transition-\[transform/);
  });
  it("renders as a link when asChild is used", () => {
    render(<Button asChild><a href="/shop">Shop</a></Button>);
    expect(screen.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
  });
});

describe("MagneticButton", () => {
  it("renders a link with an accessible label", () => {
    render(<MagneticButton href="/es/shop/arrangements" ariaLabel="Comprar">Comprar</MagneticButton>);
    expect(screen.getByRole("link", { name: "Comprar" })).toHaveAttribute("href", "/es/shop/arrangements");
  });
});
