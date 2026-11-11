#!/usr/bin/env tsx
/**
 * Dry run of the card-date reader over a COPY of the real database.
 *
 * Only for a local copy: it refuses to run unless SQLITE_FILE is set and points
 * somewhere other than data/diva.sqlite. This script SENDS NOTHING.
 *
 *   SQLITE_FILE=<copy> npm run card-dates:dry-run                    # preview JSON
 *   SQLITE_FILE=<copy> npm run card-dates:dry-run -- --sample 30     # + sample of dates and every review
 *   SQLITE_FILE=<copy> npm run card-dates:dry-run -- --commit        # really scans (into the copy)
 *   SQLITE_FILE=<copy> npm run card-dates:dry-run -- --check-reminders  # card dates in reminders: expect 0
 *
 * --sample prints real card text to the terminal: never paste it anywhere.
 */
import path from "node:path";
import { getDb } from "../lib/db";
import { withTransaction } from "../lib/db-tx";
import { dueReminders } from "../lib/date-reminders";
import { listCardReviews, previewCardScan, scanPendingCardDates } from "../lib/card-dates-scan";

class SampleRollback extends Error {}

function guard(): void {
  const file = process.env.SQLITE_FILE;
  if (!file) {
    console.error("Refusing to run: SQLITE_FILE is not set. Point it at a COPY of the database.");
    process.exit(1);
  }
  if (path.resolve(file) === path.resolve(process.cwd(), "data", "diva.sqlite")) {
    console.error("Refusing to run: SQLITE_FILE points at data/diva.sqlite. Use a copy.");
    process.exit(1);
  }
}

function sample(n: number): void {
  const db = getDb();
  let out: { saved: unknown[]; review: unknown[] } | undefined;
  try {
    withTransaction(() => {
      const report = scanPendingCardDates();
      const saved = db
        .prepare(
          `SELECT o.card_message AS message, d.kind, d.month, d.day, d.year, d.label, d.relationship
             FROM customer_important_dates d JOIN orders o ON o.id = d.source_order_id
            WHERE d.source = 'card' ORDER BY o.created_at, o.id`,
        )
        .all() as Array<Record<string, unknown>>;
      // Evenly spaced, so the sample covers the whole history.
      const step = Math.max(1, Math.floor(saved.length / n));
      const picked = saved.filter((_, i) => i % step === 0).slice(0, n);
      const review = listCardReviews().map((r) => ({
        message: r.cardMessage,
        month: r.month,
        day: r.day,
        years: r.years,
        person: r.recipientName,
        relationship: r.relationship,
        needsName: r.needsName,
      }));
      out = { saved: picked, review };
      console.log(JSON.stringify({ report }, null, 2));
      throw new SampleRollback();
    });
  } catch (e) {
    if (!(e instanceof SampleRollback)) throw e;
  }
  console.log(JSON.stringify({ sampleOfSavedDates: out?.saved, allReviews: out?.review }, null, 2));
}

function checkReminders(): void {
  const db = getDb();
  const cardIds = new Set(
    (db.prepare("SELECT id FROM customer_important_dates WHERE source = 'card'").all() as Array<{ id: string }>).map(
      (r) => r.id,
    ),
  );
  let total = 0;
  let cardHits = 0;
  for (const stage of ["d7", "d3"] as const) {
    for (let leadDays = 0; leadDays <= 365; leadDays++) {
      for (const r of dueReminders({ leadDays, stage })) {
        total += 1;
        if (cardIds.has(r.dateId)) cardHits += 1;
      }
    }
  }
  console.log(JSON.stringify({ cardDatesInDb: cardIds.size, remindersSeen: total, cardDatesInReminders: cardHits }, null, 2));
  console.log(cardHits === 0 ? "OK: 0 card dates in reminders." : "FAIL: card dates leaked into reminders.");
  if (cardHits !== 0) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].includes("card-dates-dry-run")) {
  guard();
  const args = process.argv.slice(2);
  const si = args.indexOf("--sample");
  if (args.includes("--check-reminders")) {
    checkReminders();
  } else if (args.includes("--commit")) {
    console.log(JSON.stringify({ mode: "COMMIT (into SQLITE_FILE)", ...scanPendingCardDates() }, null, 2));
  } else if (si >= 0) {
    const n = Number(args[si + 1]);
    sample(Number.isInteger(n) && n > 0 ? n : 30);
  } else {
    console.log(JSON.stringify({ mode: "PREVIEW (rolled back)", ...previewCardScan() }, null, 2));
  }
}
