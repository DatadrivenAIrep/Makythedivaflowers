// lib/order-storage.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Order, OrderStatus } from "@/types/order";

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

async function writeAll(all: Order[]): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
}

export async function saveOrder(order: Order): Promise<void> {
  const all = await readAll();
  all.push(order);
  await writeAll(all);
}

export async function getOrder(id: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.id === id) ?? null;
}

export async function getOrderByPaymentIntent(piId: string): Promise<Order | null> {
  const all = await readAll();
  return all.find((o) => o.stripePaymentIntentId === piId) ?? null;
}

export async function updateOrderPaymentIntent(
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return;
  all[idx] = { ...all[idx], stripePaymentIntentId: paymentIntentId };
  await writeAll(all);
}

// `paid` and `delivered` are terminal; never downgrade. Other transitions overwrite.
const TERMINAL: OrderStatus[] = ["paid", "delivered"];

export async function updateOrderStatusByPaymentIntent(
  paymentIntentId: string,
  status: OrderStatus,
): Promise<void> {
  const all = await readAll();
  const idx = all.findIndex((o) => o.stripePaymentIntentId === paymentIntentId);
  if (idx < 0) return;
  const current = all[idx].status;
  if (TERMINAL.includes(current) && current !== status) return;
  if (current === status) return;
  all[idx] = { ...all[idx], status };
  await writeAll(all);
}
