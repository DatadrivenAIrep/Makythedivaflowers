import { describe, it, expect, vi } from "vitest";
import { enableWalWithRetry } from "@/lib/db-wal";

/**
 * `PRAGMA journal_mode = WAL` needs an exclusive lock and, unlike ordinary
 * statements, returns SQLITE_BUSY immediately instead of waiting out
 * `busy_timeout`. During `next build` seven prerender workers open the database
 * at once, so on a fresh file one of them can hit a peer that is still applying
 * migrations and fail the whole build.
 */
function busyError() {
  return Object.assign(new Error("database is locked"), {
    code: "ERR_SQLITE_ERROR",
    errcode: 5,
  });
}

describe("enableWalWithRetry", () => {
  it("succeeds on the first try when nothing is holding a lock", () => {
    const exec = vi.fn();
    expect(enableWalWithRetry(exec, { attempts: 5, sleepMs: 0 })).toBe(true);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("retries a busy database and succeeds once the peer finishes", () => {
    const exec = vi
      .fn()
      .mockImplementationOnce(() => { throw busyError(); })
      .mockImplementationOnce(() => { throw busyError(); })
      .mockImplementationOnce(() => undefined);

    expect(enableWalWithRetry(exec, { attempts: 5, sleepMs: 0 })).toBe(true);
    expect(exec).toHaveBeenCalledTimes(3);
  });

  it("gives up after the attempt budget without throwing", () => {
    // The database is still usable in rollback-journal mode, and a later
    // connection will switch it. Failing the build here would be worse.
    const exec = vi.fn().mockImplementation(() => { throw busyError(); });
    expect(enableWalWithRetry(exec, { attempts: 3, sleepMs: 0 })).toBe(false);
    expect(exec).toHaveBeenCalledTimes(3);
  });

  it("rethrows an error that is not a lock problem", () => {
    const exec = vi.fn().mockImplementation(() => {
      throw new Error("disk I/O error");
    });
    expect(() => enableWalWithRetry(exec, { attempts: 3, sleepMs: 0 })).toThrow("disk I/O error");
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
