import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VariantChips } from "@/components/product/VariantChips";
import type { Product } from "@/types/product";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const variants = [
  { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 10000 },
  { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 15000 },
  { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 20000 },
];
const product = (category: string) => ({ category, variants }) as unknown as Product;

describe("VariantChips base size", () => {
  it("tells the shopper the base each arrangement size is built on", () => {
    render(<VariantChips product={product("arrangements")} locale="es" value="standard" onChange={() => {}} />);
    expect(screen.getByText("Base de 5″ × 5″")).toBeInTheDocument();
    expect(screen.getByText("Base de 6″ × 6″")).toBeInTheDocument();
    expect(screen.getByText("Base de 8″ × 8″")).toBeInTheDocument();
  });

  it("says it in English on the English site", () => {
    render(<VariantChips product={product("arrangements")} locale="en" value="standard" onChange={() => {}} />);
    expect(screen.getByText("6″ × 6″ base")).toBeInTheDocument();
  });

  it("says nothing about a base on a hand-tied bouquet", () => {
    render(<VariantChips product={product("bouquets")} locale="es" value="standard" onChange={() => {}} />);
    expect(screen.queryByText(/base/i)).not.toBeInTheDocument();
  });
});
