import { PRODUCTS } from "@/data/products";
import { getAllPriceOverrides } from "@/lib/product-prices";
import ProductPricesPage from "@/components/admin/products/ProductPricesPage";

export default async function AdminProductsPage() {
  const overrides = getAllPriceOverrides();
  return <ProductPricesPage products={PRODUCTS} initialOverrides={overrides} />;
}
