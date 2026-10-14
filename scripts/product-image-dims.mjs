// Measures every image under public/products and writes data/product-image-dims.json
// ({"/products/<file>": [width, height]}) so product cards can show the whole photo,
// uncropped, in a frame shaped like it. Run `npm run images:dims` after adding or
// replacing catalog photos; tests/unit/product-image-dims.test.ts fails when stale.
//
// Dependency-free: reads the JPEG / PNG / WebP headers directly. JPEG sizes are
// swapped when the EXIF orientation is 5-8, which is how browsers display them.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "public", "products");
const OUT = join(ROOT, "data", "product-image-dims.json");
const EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function png(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function exifOrientation(seg) {
  if (seg.length < 14 || seg.toString("latin1", 0, 6) !== "Exif\0\0") return null;
  const t = seg.subarray(6);
  const le = t.toString("latin1", 0, 2) === "II";
  const u16 = (o) => (le ? t.readUInt16LE(o) : t.readUInt16BE(o));
  const u32 = (o) => (le ? t.readUInt32LE(o) : t.readUInt32BE(o));
  if (t.length < 8 || u16(2) !== 0x2a) return null;
  const ifd = u32(4);
  if (ifd + 2 > t.length) return null;
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > t.length) return null;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return null;
}

function jpeg(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  let orientation = 1;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // standalone marker, no length
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    if (marker === 0xe1) {
      orientation = exifOrientation(buf.subarray(i + 4, i + 2 + len)) ?? orientation;
    }
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      return orientation >= 5 ? { w: h, h: w } : { w, h };
    }
    if (marker === 0xda) return null; // scan data before any frame header
    i += 2 + len;
  }
  return null;
}

function webp(buf) {
  if (buf.length < 30) return null;
  if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("latin1", 12, 16);
  if (chunk === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  return null;
}

export function measure(buf) {
  return png(buf) ?? jpeg(buf) ?? webp(buf);
}

function main() {
  const lines = [];
  for (const file of readdirSync(DIR).sort()) {
    if (!EXT.has(extname(file).toLowerCase())) continue;
    const dims = measure(readFileSync(join(DIR, file)));
    if (!dims) {
      console.error(`cannot read dimensions: ${file}`);
      process.exitCode = 1;
      continue;
    }
    lines.push(`  ${JSON.stringify(`/products/${file}`)}: [${dims.w}, ${dims.h}]`);
  }
  writeFileSync(OUT, `{\n${lines.join(",\n")}\n}\n`);
  console.log(`measured ${lines.length} images -> data/product-image-dims.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
