import "server-only";
import { getDb } from "@/lib/db";

let depth = 0;

/**
 * Run `fn` in one SQLite write transaction. Nested calls join the outer one, so
 * a writer can wrap its own update and still be called from a wider transaction.
 */
export function withTransaction<T>(fn: () => T): T {
  if (depth > 0) return fn();
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  depth++;
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  } finally {
    depth--;
  }
}
