import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterChip } from "@/components/product/FilterChip";
import { VariantChips } from "@/components/product/VariantChips";
import type { Product } from "@/types/product";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

describe("FilterChip", () => {
  it("gives instant press feedback and toggles", () => {
    const onToggle = vi.fn();
    render(<FilterChip label="Pink" selected={false} onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: "Pink" });
    expect(btn.className).toMatch(/active:scale-\[0\.9/);      // press feedback
    expect(btn.className).toMatch(/transition-\[transform/);   // transform transitioned
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe("VariantChips", () => {
  const product = {
    variants: [
      { id: "lush", label: { en: "Standard", es: "Estándar" }, priceCents: 20000 },
      { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 30000 },
    ],
  } as unknown as Product;
  it("renders variants with press feedback and fires onChange", () => {
    const onChange = vi.fn();
    render(<VariantChips product={product} locale="en" value="lush" onChange={onChange} />);
    const grand = screen.getByRole("button", { name: /Grand/ });
    expect(grand.className).toMatch(/active:scale-\[0\.9/);
    fireEvent.click(grand);
    expect(onChange).toHaveBeenCalledWith("grand");
  });
});
