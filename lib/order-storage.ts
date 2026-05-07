// lib/order-storage.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Order, OrderStatus } from "@/types/order";

// Tests override `ORDER_STORAGE_FILE` to isolate parallel runs. In production this is unset
// and we use the project-root pending-orders.json (same path the legacy code used).
function storageFile(): string {
  const override = process.env.ORDER_STORAGE_FILE;
  if (override) return path.isAbsolute(override) ? override : path.resolve(override);
  return path.join(process.cwd(), "pending-orders.json");
}

async function readAll(): Promise<Order[]> {
  try {
    const raw = await fs.readFile(storageFile(), "utf8");
    return JSON.parse(raw) as Order[];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

async function writeAll(all: Order[]): Promise<void> {
  await fs.writeFile(storageFile(), JSON.stringify(all, null, 2), "utf8");
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

// `paid` and `delivered` are both terminal for webhook purposes.
// `delivered` is set by internal fulfilment tooling, never by Stripe events.
// Once in either state, status must not regress regardless of late-arriving webhooks.
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
