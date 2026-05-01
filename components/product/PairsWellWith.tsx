import { motion } from "framer-motion";
import { ProductCard } from "./ProductCard";
import { StaggerGroup, staggerItemVariants } from "@/components/motion/StaggerGroup";
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";

type Props = { products: Product[]; locale: Locale };

export function PairsWellWith({ products, locale }: Props) {
  if (products.length === 0) return null;
  const title = locale === "es" ? "Combina bien con" : "Pairs well with";
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="font-display text-3xl leading-none tracking-tighter md:text-4xl">{title}</h2>
      </div>
      <StaggerGroup className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
        {products.slice(0, 4).map((p) => (
          <motion.div key={p.id} variants={staggerItemVariants}>
            <ProductCard product={p} locale={locale} />
          </motion.div>
        ))}
      </StaggerGroup>
    </div>
  );
}
