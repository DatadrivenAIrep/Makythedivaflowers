import { getDb } from "@/lib/db";

export interface Customer {
  name: string;
  phone: string;
  orderAt: string;
}

function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  return phone.replace(/\D/g, "");
}

export function upsertOnOrder(customer: Customer): void {
  const db = getDb();
  const normalized = normalizePhone(customer.phone);
  
  const stmt = db.prepare(`
    INSERT INTO customers (phone, name, orderAt)
    VALUES (?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = excluded.name,
      orderAt = excluded.orderAt
  `);
  
  stmt.run(normalized, customer.name, customer.orderAt);
}

export function getByPhone(phone: string): Customer | null {
  const db = getDb();
  const normalized = normalizePhone(phone);
  
  const stmt = db.prepare(`
    SELECT name, phone, orderAt FROM customers WHERE phone = ?
  `);
  
  const row = stmt.get(normalized);
  if (!row) return null;
  
  return row as Customer;
}
