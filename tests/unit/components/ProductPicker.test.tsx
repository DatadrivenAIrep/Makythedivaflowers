import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ProductPicker from "@/components/admin/intake/ProductPicker";
import type { Product } from "@/types/product";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k, useLocale: () => "es" }));

const products = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i + 1}`,
  title: { en: `Prod ${i + 1}`, es: `Prod ${i + 1}` },
  variants: [{ id: "v", priceCents: 5000 }],
  images: [],
})) as unknown as Product[];

describe("ProductPicker", () => {
  it("renders more than 9 products (no 9-item cap)", () => {
    render(<ProductPicker products={products} onAdd={() => {}} />);
    expect(screen.getByText("Prod 10")).toBeInTheDocument();
    expect(screen.getByText("Prod 12")).toBeInTheDocument();
  });
});
