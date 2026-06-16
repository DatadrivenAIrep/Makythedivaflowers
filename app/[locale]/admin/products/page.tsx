import { PRODUCTS } from "@/data/products";
import { getAllPriceOverrides } from "@/lib/product-prices";
import { getAllImageOverrides } from "@/lib/product-images";
import ProductPricesPage from "@/components/admin/products/ProductPricesPage";

export default async function AdminProductsPage() {
  const overrides = getAllPriceOverrides();
  const imageOverrides = getAllImageOverrides();
  return (
    <ProductPricesPage
      products={PRODUCTS}
      initialOverrides={overrides}
      initialImageOverrides={imageOverrides}
    />
  );
}
