import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
  useLocale: () => "es",
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import ProductPicker from "@/components/admin/intake/ProductPicker";
import type { Product } from "@/types/product";

const multi: Product = {
  id: "p-multi",
  slug: "talitas-bouquet",
  title: { en: "Talita's Bouquet", es: "El Ramo de Talita" },
  category: "bouquets",
  blurb: { en: "b", es: "b" },
  description: { en: "d", es: "d" },
  images: [{ src: "/products/talitas-bouquet.jpg", alt: { en: "a", es: "a" }, aspect: "4/5" }],
  variants: [
    { id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 },
    { id: "grand", label: { en: "Grand", es: "Grande" }, priceCents: 12500 },
    { id: "diva", label: { en: "Diva", es: "Diva" }, priceCents: 17000 },
  ],
  tags: [],
  occasions: [],
  colorFamily: ["pink"],
  active: true,
  seo: { title: { en: "t", es: "t" }, description: { en: "d", es: "d" } },
};

const single: Product = {
  ...multi,
  id: "p-single",
  slug: "single",
  title: { en: "Single", es: "Único" },
  variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 5000 }],
};

describe("ProductPicker size selection", () => {
  it("offers every variant of a multi-size product and adds the one tapped", () => {
    const onAdd = vi.fn();
    render(<ProductPicker products={[multi]} onAdd={onAdd} />);

    // All three sizes are visible as their own tap targets, with their prices.
    expect(screen.getByRole("button", { name: /Estándar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Grande/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Diva/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Grande/ })).toHaveTextContent("$125");

    fireEvent.click(screen.getByRole("button", { name: /Grande/ }));
    expect(onAdd).toHaveBeenCalledWith({
      kind: "catalog",
      productId: "p-multi",
      variantId: "grand",
      addOnIds: [],
      qty: 1,
    });
  });

  it("never adds a multi-size product without an explicit size choice", () => {
    const onAdd = vi.fn();
    render(<ProductPicker products={[multi]} onAdd={onAdd} />);
    fireEvent.click(screen.getByAltText("a"));
    fireEvent.click(screen.getByText("El Ramo de Talita"));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("still adds a single-variant product in one tap", () => {
    const onAdd = vi.fn();
    render(<ProductPicker products={[single]} onAdd={onAdd} />);
    fireEvent.click(screen.getByText("Único"));
    expect(onAdd).toHaveBeenCalledWith({
      kind: "catalog",
      productId: "p-single",
      variantId: "standard",
      addOnIds: [],
      qty: 1,
    });
  });
});
