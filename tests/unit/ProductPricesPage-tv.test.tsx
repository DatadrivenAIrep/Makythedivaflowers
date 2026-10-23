import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import esMessages from "@/messages/es.json";
import type { Product } from "@/types/product";

vi.mock("@/lib/product-image-dims", () => ({
  productImageDims: (src: string) => (src.startsWith("/small/") ? { width: 500, height: 600 } : { width: 1800, height: 2400 }),
}));

import ProductPricesPage from "@/components/admin/products/ProductPricesPage";

function product(id: string, over: Partial<Product> = {}): Product {
  return {
    id, slug: id, addedAt: "2026-10-01",
    title: { en: `${id} EN`, es: `${id} ES` },
    category: "arrangements",
    blurb: { en: "", es: "" }, description: { en: "", es: "" },
    images: [{ src: `/products/${id}.jpg`, alt: { en: "", es: "" }, aspect: "4/5" }],
    variants: [{ id: "standard", label: { en: "Standard", es: "Estándar" }, priceCents: 8500 }],
    tags: [], occasions: [], colorFamily: [], active: true,
    seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
    ...over,
  };
}

function renderPage(products: Product[], tv: Record<string, boolean> = {}) {
  return render(
    <NextIntlClientProvider locale="es" messages={esMessages}>
      <ProductPricesPage products={products} initialOverrides={[]} initialImageOverrides={[]} initialTvVisibility={tv} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

it("shows the effective state: default on, sympathy off, saved row wins", () => {
  renderPage([product("a"), product("s", { category: "sympathy" }), product("h")], { h: false });
  expect(screen.getByRole("switch", { name: "En la TV — a ES" })).toHaveAttribute("aria-checked", "true");
  expect(screen.getByRole("switch", { name: "En la TV — s ES" })).toHaveAttribute("aria-checked", "false");
  expect(screen.getByRole("switch", { name: "En la TV — h ES" })).toHaveAttribute("aria-checked", "false");
});

it("toggling saves to the API", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
  renderPage([product("a")]);
  const sw = screen.getByRole("switch", { name: "En la TV — a ES" });
  fireEvent.click(sw);
  await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "false"));
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/tv-showcase", expect.objectContaining({
    method: "PUT",
    body: JSON.stringify({ productId: "a", visible: false }),
  }));
});

it("reverts when the save fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  renderPage([product("a")]);
  const sw = screen.getByRole("switch", { name: "En la TV — a ES" });
  fireEvent.click(sw);
  await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "true"));
});

it("low-resolution covers get a disabled switch with the reason", () => {
  renderPage([product("lr", { images: [{ src: "/small/lr.jpg", alt: { en: "", es: "" }, aspect: "4/5" }] })]);
  expect(screen.getByRole("switch", { name: "En la TV — lr ES" })).toBeDisabled();
  expect(screen.getByText("Foto de baja resolución")).toBeInTheDocument();
});
