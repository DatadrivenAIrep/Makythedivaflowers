import Image from "next/image";
import { cn } from "@/lib/cn";
import { productImageDims } from "@/lib/product-image-dims";

type Props = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  /** Classes for the absolutely-positioned stage (e.g. an inset or a hover lift). */
  className?: string;
};

/**
 * A catalog photo shown whole, never cropped, resting on the bottom of whatever
 * box contains it, with its edges feathered into the plaster background so the
 * arrangement looks like it floats. The parent must be `position: relative`
 * with a definite size. Works for any box shape: the image keeps its own
 * proportions and shrinks to fit (`max-w-full max-h-full`).
 *
 * Measured sizes come from data/product-image-dims.json (`npm run images:dims`);
 * an unmeasured photo falls back to an uncropped `fill` + `object-contain`.
 */
export function FloatingPhoto({ src, alt, sizes, priority, className }: Props) {
  const dims = productImageDims(src);
  const feather = "mask-x-from-90% mask-y-from-90%";
  return (
    <div
      data-testid="floating-photo"
      // grid-rows-1 = one minmax(0,1fr) row: gives the row a definite height so the
      // image's max-h-full resolves against the stage instead of its own size.
      className={cn("absolute inset-0 grid grid-rows-1 items-end justify-items-center", className)}
    >
      {dims ? (
        <Image
          src={src}
          alt={alt}
          width={dims.width}
          height={dims.height}
          sizes={sizes}
          priority={priority}
          className={cn("block h-auto max-h-full min-h-0 w-auto max-w-full", feather)}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-contain object-bottom", feather)}
        />
      )}
    </div>
  );
}
