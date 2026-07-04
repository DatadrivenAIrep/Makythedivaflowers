// One-time importer: pending-inquiries.json wedding/event records → SQLite.
// Idempotent by id. Run: NODE_OPTIONS='--experimental-sqlite' tsx scripts/migrate-inquiries-json-to-sqlite.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { createInquiry, getInquiry } from "@/lib/inquiry-storage-db";

type Rec = { id: string; type: string; payload: Record<string, unknown>; createdAt: string; locale?: string };

async function main() {
  const file = path.join(process.cwd(), "pending-inquiries.json");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    console.log("no pending-inquiries.json — nothing to migrate");
    return;
  }
  const records = JSON.parse(raw) as Rec[];
  let imported = 0;
  for (const r of records) {
    if (r.type !== "wedding" && r.type !== "event") continue;
    if (getInquiry(r.id)) continue; // idempotent
    const p = r.payload as {
      contact: { name: string; email: string; phone: string };
      budgetBand?: string; vibe?: string; date?: string; venue?: string; guests?: number;
      company?: string; frequency?: string;
    };
    createInquiry({
      id: r.id,
      type: r.type,
      contactName: p.contact.name,
      contactEmail: p.contact.email,
      contactPhone: p.contact.phone,
      budgetBand: p.budgetBand as never,
      eventDate: p.date || undefined,
      venue: p.venue || undefined,
      guests: p.guests,
      company: p.company,
      frequency: p.frequency,
      vibe: p.vibe,
      sourceChannel: "web",
      locale: r.locale,
      createdAt: r.createdAt,
    });
    imported += 1;
  }
  console.log(`migrated ${imported} wedding/event inquiries`);
}

main();
