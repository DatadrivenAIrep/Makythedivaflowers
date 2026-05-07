import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types/product";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

const stub: Product = {
  id: "p1",
  slug: "test-arrangement",
  active: true,
  category: "arrangements",
  title: { en: "Test Arrangement", es: "Arreglo de Prueba" },
  blurb: { en: "x", es: "x" },
  description: { en: "x", es: "x" },
  seo: { title: { en: "x", es: "x" }, description: { en: "x", es: "x" } },
  images: [{ src: "/test.jpg", alt: { en: "alt", es: "alt" }, aspect: "4/5" }],
  variants: [{ id: "lush", label: { en: "Lush", es: "Lush" }, priceCents: 9500 }],
  tags: [],
  occasions: ["mothers-day"],
  colorFamily: ["pink"],
} as unknown as Product;

describe("ProductCard", () => {
  it("renders a link without a campaign query string by default", () => {
    render(<ProductCard product={stub} locale="en" />);
    const link = screen.getByTestId("product-card");
    expect(link.getAttribute("href")).toBe("/en/product/test-arrangement");
  });

  it("appends ?campaign=<value> when campaign prop is set", () => {
    render(<ProductCard product={stub} locale="en" campaign="mothers-day" />);
    const link = screen.getByTestId("product-card");
    expect(link.getAttribute("href")).toBe("/en/product/test-arrangement?campaign=mothers-day");
  });

  it("URL-encodes campaign values", () => {
    render(<ProductCard product={stub} locale="en" campaign={"weird value" as never} />);
    const link = screen.getByTestId("product-card");
    expect(link.getAttribute("href")).toBe("/en/product/test-arrangement?campaign=weird%20value");
  });
});
