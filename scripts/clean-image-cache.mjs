// Runs before `next start`. Removes broken entries from Next's image cache.
//
// Next 16.2.4 builds a disk LRU from `.next/cache/images` the first time an
// image is cached. If any cached file is 0 bytes (a write cut short when the
// host killed the process), `LRUCache.set` throws, the init promise stays
// rejected for the life of the process, no image is ever cached again, and
// every /_next/image request runs sharp. On the shared Hostinger plan that
// pushed the account to its 400-process limit and took the site down
// (2026-11-24). Dropping empty entries at startup lets the cache initialise.
//
// Never fails the start: any error here is logged and ignored.
import { promises as fs } from "node:fs";
import path from "node:path";

const cacheDir = path.join(process.cwd(), ".next", "cache", "images");

async function main() {
  let keys;
  try {
    keys = await fs.readdir(cacheDir);
  } catch {
    return; // no cache yet
  }
  let removed = 0;
  for (const key of keys) {
    const dir = path.join(cacheDir, key);
    try {
      const files = await fs.readdir(dir);
      let broken = files.length === 0;
      for (const file of files) {
        const { size } = await fs.stat(path.join(dir, file));
        if (size === 0) broken = true;
      }
      if (broken) {
        await fs.rm(dir, { recursive: true, force: true });
        removed++;
      }
    } catch {
      // not a directory or unreadable: Next skips these itself
    }
  }
  if (removed) console.log(`[clean-image-cache] removed ${removed} broken image cache entr${removed === 1 ? "y" : "ies"}`);
}

main().catch((err) => console.error("[clean-image-cache] skipped:", err));
