import IntakeForm from "@/components/admin/intake/IntakeForm";
import { PRODUCTS } from "@/data/products";

export default function IntakePage() {
  return <IntakeForm products={PRODUCTS} />;
}
