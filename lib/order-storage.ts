// lib/order-storage.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Order } from "@/types/order";

const FILE = path.join(process.cwd(), "pending-orders.json");

async function readAll(): Promise<Order[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return JSON.parse(raw) as Order[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function saveOrder(order: Order): Promise<void> {
  const all = await readAll();
  all.push(order);
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
}

export async function getOrder(id: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.id === id) ?? null;
}
