import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MothersDayEdit } from "@/components/mothers-day/MothersDayEdit";

vi.mock("@/components/product/ProductGrid", () => ({
  ProductGrid: ({ products }: any) => (
    <div data-testid="product-grid">
      {products.map((p: any) => (
        <span key={p.id} data-testid="product-tile">
          {p.slug}
        </span>
      ))}
    </div>
  ),
}));

describe("MothersDayEdit", () => {
  it("renders products in the order of the slug list, skipping unknowns", () => {
    render(
      <MothersDayEdit
        locale="en"
        slugs={["blush-enchantment", "this-does-not-exist", "dona-rosita"]}
      />,
    );
    const tiles = screen.getAllByTestId("product-tile");
    expect(tiles.map((t) => t.textContent)).toEqual([
      "blush-enchantment",
      "dona-rosita",
    ]);
  });
});
