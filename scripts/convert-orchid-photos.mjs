// scripts/convert-orchid-photos.mjs
// One-time converter: <input dir>/<IMG> -> public/products/phalaenopsis-<slug>.webp
// Mirrors scripts/convert-sympathy-photos.mjs: qlmanage renders with EXIF
// orientation baked in (sips/sharp mis-rotate or fail on HEIC here), then
// cwebp encodes at q80. No crops — all four frames are already tight.
// Usage: node scripts/convert-orchid-photos.mjs [inputDir]
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const INPUT_DIR = process.argv[2] || join(homedir(), "Downloads");
const OUT_DIR = join(process.cwd(), "public", "products");
const MAX_EDGE = 2000;
const QUALITY = 80;

const MANIFEST = [
  { src: "IMG_1957.HEIC", slug: "phalaenopsis-white-single" },
  { src: "IMG_1962.heic", slug: "phalaenopsis-pink-single" },
  { src: "IMG_1959.HEIC", slug: "phalaenopsis-pink-double" },
  { src: "IMG_1968.heic", slug: "phalaenopsis-fuchsia-double" },
];

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

function renderOriented(src, dir) {
  run("qlmanage", ["-t", "-s", String(MAX_EDGE), "-o", dir, src]);
  const png = readdirSync(dir).find((f) => f.endsWith(".png"));
  if (!png) throw new Error(`qlmanage produced no thumbnail for ${src}`);
  return join(dir, png);
}

async function convertOne({ src, slug }) {
  const inPath = join(INPUT_DIR, src);
  if (!existsSync(inPath)) return { slug, ok: false, reason: "source missing" };
  const outPath = join(OUT_DIR, `${slug}.webp`);
  const dir = mkdtempSync(join(tmpdir(), "orc_"));
  try {
    const png = renderOriented(inPath, dir);
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
