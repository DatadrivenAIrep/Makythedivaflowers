import { cn } from "@/lib/cn";
import type { ProductImage as ProductImageT } from "@/types/product";
import type { Locale } from "@/types/locale";

type Props = {
  image: ProductImageT;
  locale: Locale;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

const aspectClass: Record<ProductImageT["aspect"], string> = {
  "4/5": "aspect-[4/5]",
  "1/1": "aspect-square",
  "16/9": "aspect-video",
};

export function ProductImage({ image, locale, className, sizes, priority }: Props) {
  return (
    <img
      src={image.src}
      alt={image.alt[locale]}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      className={cn("size-full object-cover", aspectClass[image.aspect], className)}
    />
  );
}
