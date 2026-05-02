// lib/inquiry-storage.ts
import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "pending-inquiries.json");

export type InquiryRecord = {
  id: string;
  type: "wedding" | "event" | "subscription" | "contact" | "newsletter";
  payload: unknown;
  createdAt: string;
  ip: string;
  locale: "en" | "es";
};

async function readAll(): Promise<InquiryRecord[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as InquiryRecord[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function saveInquiry(record: InquiryRecord): Promise<void> {
  const all = await readAll();
  all.push(record);
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
}
