/**
 * Turning on WAL is the one statement `busy_timeout` does not cover.
 *
 * `PRAGMA journal_mode = WAL` needs an exclusive lock, and SQLite answers
 * SQLITE_BUSY straight away rather than invoking the busy handler. That is fine
 * in a single process, but `next build` prerenders with seven worker processes
 * that all open the database at once: against a fresh file, one worker is still
 * applying migrations inside a write transaction while the others try to switch
 * journal mode, and the loser crashes the whole build.
 *
 * So retry a few times, then carry on. A database in rollback-journal mode still
 * works; the next connection to find it unlocked will switch it. Failing the
 * build over a journal mode would be the worse outcome.
 */

export type ExecFn = (sql: string) => void;

function isBusy(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const err = e as { errcode?: number; message?: string };
  return err.errcode === 5 || /database is locked|database table is locked/i.test(err.message ?? "");
}

/** Block the thread without spinning the CPU — node:sqlite's API is synchronous. */
function sleepSync(ms: number): void {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function enableWalWithRetry(
  exec: ExecFn,
  { attempts = 10, sleepMs = 50 }: { attempts?: number; sleepMs?: number } = {},
): boolean {
  for (let i = 0; i < attempts; i++) {
    try {
      exec("PRAGMA journal_mode = WAL");
      return true;
    } catch (e) {
      if (!isBusy(e)) throw e;
      sleepSync(sleepMs);
    }
  }
  return false;
}
