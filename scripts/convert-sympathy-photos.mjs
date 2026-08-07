// scripts/convert-sympathy-photos.mjs
// One-time converter: "Sympathy fotos"/<IMG> -> public/sympathy/<slug>.webp
// Mirrors scripts/convert-portfolio-media.mjs: qlmanage renders with EXIF
// orientation baked in (sips/sharp mis-rotate many HEIC/JPEG here, and sharp
// cannot even decode HEIC on this machine), then cwebp encodes at q80.
// A few shop-floor shots get a fractional crop (via sharp, on the oriented PNG)
// to trim workshop clutter before encoding.
// Usage: node scripts/convert-sympathy-photos.mjs ["Sympathy fotos"]
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const INPUT_DIR = process.argv[2] || join(process.cwd(), "Sympathy fotos");
const OUT_DIR = join(process.cwd(), "public", "sympathy");
const MAX_EDGE = 2000;
const QUALITY = 80;

// src: filename in INPUT_DIR. slug: output basename. crop: optional fractions
// {left, top, width, height} of the EXIF-oriented image (0..1).
const MANIFEST = [
  { src: "IMG_20210827_164935_384.JPG", slug: "heart-in-full-color" },
  { src: "IMG_6600.HEIC", slug: "tender-heart" },
  { src: "IMG_6506.HEIC", slug: "golden-grace" },
  { src: "IMG_8591.HEIC", slug: "chapel-white" },
  { src: "IMG_8175.HEIC", slug: "amethyst-orchid" },
  { src: "IMG_0230.HEIC", slug: "white-repose" },
  { src: "IMG_9859.HEIC", slug: "cross-of-peace" },
  { src: "IMG_20190520_134258_419.JPG", slug: "eternal-white" },
  { src: "IMG_2678.heic", slug: "twilight-orchid" },
  { src: "IMG_2704.HEIC", slug: "sunflower-tribute" },
  { src: "IMG_2700.HEIC", slug: "blue-remembrance" },
  { src: "IMG_3098.JPG", slug: "circle-of-warmth", crop: { left: 0.03, top: 0.06, width: 0.94, height: 0.8 } },
  // IMG_9504 (elegant funeral-home setting) over IMG_7860 (shop-cooler background);
  // crop centers the red heart, trimming the neighboring spray at left.
  { src: "IMG_9504.HEIC", slug: "crimson-heart", crop: { left: 0.12, top: 0.14, width: 0.76, height: 0.72 } },
];

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

// qlmanage -> PNG (EXIF orientation baked in), returns the PNG path inside `dir`.
function renderOriented(src, dir) {
  run("qlmanage", ["-t", "-s", String(MAX_EDGE), "-o", dir, src]);
  const png = readdirSync(dir).find((f) => f.endsWith(".png"));
  if (!png) throw new Error(`qlmanage produced no thumbnail for ${src}`);
  return join(dir, png);
}

async function convertOne({ src, slug, crop }) {
  const inPath = join(INPUT_DIR, src);
  if (!existsSync(inPath)) return { slug, ok: false, reason: "source missing" };
  const outPath = join(OUT_DIR, `${slug}.webp`);
  const dir = mkdtempSync(join(tmpdir(), "sym_"));
  try {
    let png = renderOriented(inPath, dir);
    if (crop) {
      const meta = await sharp(png).metadata();
      const box = {
        left: Math.round(crop.left * meta.width),
        top: Math.round(crop.top * meta.height),
        width: Math.round(crop.width * meta.width),
        height: Math.round(crop.height * meta.height),
      };
      const cropped = join(dir, "cropped.png");
      await sharp(png).extract(box).toFile(cropped);
      png = cropped;
    }
    run("cwebp", ["-q", String(QUALITY), png, "-o", outPath]);
    const out = await sharp(outPath).metadata();
    return { slug, ok: true, dims: `${out.width}x${out.height}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

mkdirSync(OUT_DIR, { recursive: true });
for (const item of MANIFEST) {
  const r = await convertOne(item);
  console.log(r.ok ? `OK  ${r.slug}.webp  ${r.dims}` : `SKIP ${r.slug} (${r.reason})`);
}
