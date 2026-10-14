import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/types/product";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

// Two synthetic photos with known sizes; everything else counts as "never measured".
vi.mock("@/lib/product-image-dims", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/product-image-dims")>();
  const sizes: Record<string, { width: number; height: number }> = {
    "/products/wide.jpg": { width: 2000, height: 1000 },
    "/products/tall.jpg": { width: 1000, height: 2000 },
  };
  return { ...actual, productImageDims: (src: string) => sizes[src] ?? null };
});

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

function withCover(src: string, aspect: "4/5" | "1/1" | "16/9" = "4/5"): Product {
  return { ...stub, images: [{ src, alt: { en: "alt", es: "alt" }, aspect }] } as Product;
}

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

  it("shows the whole cover without cropping it", () => {
    render(<ProductCard product={withCover("/products/tall.jpg")} locale="en" />);
    const img = screen.getByRole("img");
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("object-cover");
  });

  it("sizes the frame to a tall photo by height inside the 3:4 stage", () => {
    render(<ProductCard product={withCover("/products/tall.jpg")} locale="en" />);
    const frame = screen.getByTestId("product-frame");
    expect(frame.style.height).toBe("100%");
    expect(frame.style.width).toBe("66.67%");
  });

  it("sizes the frame to a wide photo by width inside the 3:4 stage", () => {
    render(<ProductCard product={withCover("/products/wide.jpg")} locale="en" />);
    const frame = screen.getByTestId("product-frame");
    expect(frame.style.width).toBe("100%");
    expect(frame.style.height).toBe("37.5%");
  });

  it("falls back to the catalog aspect tag when the photo was never measured", () => {
    render(<ProductCard product={withCover("/test.jpg", "16/9")} locale="en" />);
    const frame = screen.getByTestId("product-frame");
    expect(frame.style.width).toBe("100%");
    expect(frame.style.height).toBe("42.19%");
  });

  it("keeps the same-day badge inside the stage", () => {
    const sameDay = { ...withCover("/products/tall.jpg"), tags: ["same-day"] } as Product;
    render(<ProductCard product={sameDay} locale="en" />);
    const stage = screen.getByTestId("product-stage");
    expect(stage.textContent).toContain("badge_today");
  });
});
