// Runs before `next build`. Prints what the build host offers and stops the
// build if sharp's native binary cannot load there.
//
// Hostinger builds and serves on the same shared host, whose glibc is old
// (Next 16.3+'s native SWC needs GLIBC_2.29 and does not load there). sharp
// 0.35's libvips needs glibc >= 2.28. If sharp cannot load, every
// /_next/image request would fail at runtime, so failing the build here keeps
// the current deployment live instead of replacing it with a broken one.
const report = process.report?.getReport();
const glibc = report?.header?.glibcVersionRuntime ?? "n/a";
console.log(`[check-build-platform] node ${process.version}, glibc ${glibc}, ${process.platform}/${process.arch}`);

try {
  const { default: sharp } = await import("sharp");
  console.log(`[check-build-platform] sharp ${sharp.versions.sharp}, libvips ${sharp.versions.vips}: OK`);
} catch (err) {
  console.error("[check-build-platform] sharp cannot load on this host, so image optimization would break.");
  console.error(err?.message ?? err);
  process.exit(1);
}
