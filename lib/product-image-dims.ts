import table from "@/data/product-image-dims.json";

export type ImageDims = { width: number; height: number };

const DIMS: Record<string, number[]> = table;

/**
 * Pixel size of a catalog photo under public/products, as measured by
 * `npm run images:dims`. Null when the photo was never measured.
 */
export function productImageDims(src: string): ImageDims | null {
  const d = DIMS[src];
  return d && d.length === 2 ? { width: d[0], height: d[1] } : null;
}

export type StageFit = { widthPct: number; heightPct: number };

/**
 * Largest box with the photo's aspect ratio that fits inside a stage whose
 * width/height ratio is `stageRatio`, as percentages of the stage. A photo
 * wider than the stage spans its full width; a taller one spans its full height.
 */
export function fitInStage(dims: ImageDims, stageRatio: number): StageFit {
  const r = dims.width / dims.height;
  if (!(r > 0) || !(stageRatio > 0)) return { widthPct: 100, heightPct: 100 };
  return r >= stageRatio
    ? { widthPct: 100, heightPct: round((stageRatio / r) * 100) }
    : { widthPct: round((r / stageRatio) * 100), heightPct: 100 };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
