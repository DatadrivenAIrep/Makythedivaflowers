// scripts/convert-portfolio-media.mjs
// One-time converter: Downloads/<folder> -> public/<bucket>/<slug>/{pNN.webp, vNN.mp4, vNN.webp}
// Usage: node scripts/convert-portfolio-media.mjs [INPUT_BASE_DIR]   (default: ~/Downloads)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { tmpdir } from "node:os";

const INPUT_BASE = process.argv[2] || join(process.env.HOME, "Downloads");
const OUT_BASE = join(process.cwd(), "public");
const VIDEO_CAP = 4;
const MAX_EDGE = 2000;
const VIDEO_WIDTH = 1280;

const MANIFEST = [
  { folder: "Boda1", slug: "boda-01", bucket: "weddings" },
  { folder: "Boda 2", slug: "boda-02", bucket: "weddings" },
  { folder: "boda3", slug: "boda-03", bucket: "weddings" },
  { folder: "evento1", slug: "evento-01", bucket: "events" },
  { folder: "evento2", slug: "evento-02", bucket: "events" },
  { folder: "evento3", slug: "evento-03", bucket: "events" },
  { folder: "comunion", slug: "comunion-01", bucket: "events" },
];

const PHOTO_EXT = new Set([".heic", ".jpeg", ".jpg", ".png"]);
const VIDEO_EXT = new Set([".mov", ".mp4", ".m4v"]);

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
const tmpPng = () => join(tmpdir(), `pm_${process.pid}_${Math.random().toString(36).slice(2)}.png`);

const listFiles = (dir, extSet) =>
  readdirSync(dir).filter((f) => !f.startsWith(".") && extSet.has(extname(f).toLowerCase())).sort();

function videoDuration(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]).toString().trim();
  return parseFloat(out) || 0;
}

function convertPhoto(src, outWebp) {
  if (existsSync(outWebp)) return;
  const tmp = tmpPng();
  run("sips", ["-s", "format", "png", "-Z", String(MAX_EDGE), src, "--out", tmp]);
  run("cwebp", ["-q", "80", tmp, "-o", outWebp]);
}

function convertVideo(src, outMp4, outPoster) {
  if (!existsSync(outMp4)) {
    run("ffmpeg", [
      "-y", "-i", src, "-vf", `scale='min(${VIDEO_WIDTH},iw)':-2`,
      "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
      "-crf", "24", "-preset", "veryfast", "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart", outMp4,
    ]);
  }
  if (!existsSync(outPoster)) {
    const tmp = tmpPng();
    try { run("ffmpeg", ["-y", "-ss", "1", "-i", src, "-frames:v", "1", tmp]); }
    catch { run("ffmpeg", ["-y", "-ss", "0", "-i", src, "-frames:v", "1", tmp]); }
    run("cwebp", ["-q", "80", tmp, "-o", outPoster]);
  }
}

for (const { folder, slug, bucket } of MANIFEST) {
  const inDir = join(INPUT_BASE, folder);
  if (!existsSync(inDir)) { console.log(`SKIP ${folder} (not found)`); continue; }
  const outDir = join(OUT_BASE, bucket, slug);
  mkdirSync(outDir, { recursive: true });

  const photos = listFiles(inDir, PHOTO_EXT);
  photos.forEach((f, i) =>
    convertPhoto(join(inDir, f), join(outDir, `p${String(i + 1).padStart(2, "0")}.webp`)));

  const videos = listFiles(inDir, VIDEO_EXT).map((f) => ({ f, d: videoDuration(join(inDir, f)) }));
  const chosen = videos.sort((a, b) => a.d - b.d).slice(0, VIDEO_CAP);
  chosen.forEach(({ f }, i) => {
    const n = `v${String(i + 1).padStart(2, "0")}`;
    convertVideo(join(inDir, f), join(outDir, `${n}.mp4`), join(outDir, `${n}.webp`));
  });

  console.log(`${slug}: ${photos.length} photos, ${chosen.length}/${videos.length} videos`);
}
