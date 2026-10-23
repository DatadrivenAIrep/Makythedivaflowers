import { PRODUCTS } from "@/data/products";
import { getAllPriceOverrides } from "@/lib/product-prices";
import { getAllImageOverrides } from "@/lib/product-images";
import { getTvVisibility } from "@/lib/tv-showcase-storage";
import ProductPricesPage from "@/components/admin/products/ProductPricesPage";

export default async function AdminProductsPage() {
  const overrides = getAllPriceOverrides();
  const imageOverrides = getAllImageOverrides();
  const tvVisibility = Object.fromEntries(getTvVisibility());
  return (
    <ProductPricesPage
      products={PRODUCTS}
      initialOverrides={overrides}
      initialImageOverrides={imageOverrides}
      initialTvVisibility={tvVisibility}
    />
  );
}
