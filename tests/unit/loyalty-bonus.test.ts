import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";

const lookupMock = vi.fn();
const bonusMock = vi.fn();
vi.mock("@/lib/loyalty-client", async (orig) => {
  const actual = await orig<typeof import("@/lib/loyalty-client")>();
  return {
    ...actual,
    lookupCustomer: (...a: unknown[]) => lookupMock(...a),
    addBonus: (...a: unknown[]) => bonusMock(...a),
  };
});

import { LoyaltyApiError } from "@/lib/loyalty-client";
import { bonusSlotFree, claimBonus, runBonus, runDueBonuses } from "@/lib/loyalty-bonus";

const CARD = { id: 77, cardUrl: "https://card.example/c/x", rewards: { available: [] } };
const PHONE = "5165550100";

function seedCustomer(id: string, phone = PHONE) {
  const at = new Date().toISOString();
  getDb()
    .prepare("INSERT INTO customers (id, name, phone, first_seen_at, last_seen_at) VALUES (?, 'Ana', ?, ?, ?)")
    .run(id, phone, at, at);
}

function seedOrder(id: string, customerId: string, payment = "paid", fulfillment = "pending") {
  const at = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO orders (id, locale, source, customer_id, recipient_name, recipient_phone, contact_phone,
         fulfillment_method, lines_json, subtotal_cents, delivery_cents, tax_cents, total_cents, amount_paid_cents,
         fulfillment_status, payment_status, created_at, updated_at)
       VALUES (?, 'es', 'web', ?, 'Dest', '555', '5165550100', 'pickup', '[]', 0, 0, 0, 0, 0, ?, ?, ?, ?)`,
    )
    .run(id, customerId, fulfillment, payment, at, at);
}

function row(customerId = "c1", slot = "fecha") {
  return getDb().prepare("SELECT * FROM loyalty_bonus WHERE customer_id = ? AND slot = ?").get(customerId, slot) as
    | { status: string; attempts: number; last_error: string | null; created_at: string }
    | undefined;
}

beforeEach(() => {
  vi.stubEnv("SQLITE_FILE", ":memory:");
  vi.stubEnv("LOYALTY_API_URL", "https://loyalty.example/api/v1");
  vi.stubEnv("LOYALTY_API_KEY", "k");
  vi.stubEnv("DATE_REWARDS_ENABLED", "1");
  runMigrations();
  lookupMock.mockReset();
  bonusMock.mockReset();
  lookupMock.mockResolvedValue(CARD);
  bonusMock.mockResolvedValue(undefined);
  seedCustomer("c1");
  seedOrder("o1", "c1");
});
afterEach(() => {
  closeDb();
  vi.unstubAllEnvs();
});

describe("claimBonus", () => {
  it("sin pedido pagado no reclama el cupo", () => {
    seedCustomer("c2", "5165550199");
    seedOrder("o2", "c2", "pending");
    seedCustomer("c3", "5165550198");
    seedOrder("o3", "c3", "paid", "canceled");
    expect(claimBonus("c2", "fecha")).toBe(false);
    expect(claimBonus("c3", "fecha")).toBe(false);
    expect(claimBonus("nadie", "fecha")).toBe(false);
    expect(row("c2")).toBeUndefined();
    expect(bonusSlotFree("c2", "fecha")).toBe(true);
  });

  it("el mismo cupo no se reclama dos veces", () => {
    expect(claimBonus("c1", "fecha")).toBe(true);
    expect(bonusSlotFree("c1", "fecha")).toBe(false);
    expect(claimBonus("c1", "fecha")).toBe(false);
    expect(claimBonus("c1", "gustos")).toBe(true);
  });

  it("no reclama con la función o la tarjeta apagadas", () => {
    vi.stubEnv("DATE_REWARDS_ENABLED", "");
    expect(claimBonus("c1", "fecha")).toBe(false);
    vi.stubEnv("DATE_REWARDS_ENABLED", "1");
    vi.stubEnv("LOYALTY_API_KEY", "");
    expect(claimBonus("c1", "fecha")).toBe(false);
    expect(row()).toBeUndefined();
  });
});

describe("runBonus", () => {
  it("envía el sello con el orderId de la tarjeta", async () => {
    claimBonus("c1", "fecha");
    await runBonus("c1", "fecha");
    expect(lookupMock).toHaveBeenCalledWith("+15165550100", { timeoutMs: 10_000 });
    expect(bonusMock).toHaveBeenCalledWith(77, "diva-dato-fecha-77", "Diva: fecha guardada", expect.anything());
    expect(row()?.status).toBe("done");
    claimBonus("c1", "gustos");
    await runBonus("c1", "gustos");
    expect(bonusMock).toHaveBeenLastCalledWith(77, "diva-dato-gustos-77", "Diva: gustos guardados", expect.anything());
  });

  it("dos registros de Diva con la misma tarjeta usan el mismo orderId", async () => {
    seedCustomer("c2", "+1 (516) 555-0100"); // misma persona, otro formato
    seedOrder("o2", "c2");
    claimBonus("c1", "fecha");
    claimBonus("c2", "fecha");
    await runBonus("c1", "fecha");
    await runBonus("c2", "fecha");
    expect(bonusMock.mock.calls.map((c) => c[1])).toEqual(["diva-dato-fecha-77", "diva-dato-fecha-77"]);
  });

  it("sin tarjeta y con un pedido por registrar, espera", async () => {
    lookupMock.mockResolvedValue(null);
    getDb()
      .prepare(
        `INSERT INTO loyalty_sync (order_id, kind, loyalty_order_id, status, created_at, updated_at)
         VALUES ('o1', 'sync', 'diva-1', 'pending', 'a', 'a')`,
      )
      .run();
    claimBonus("c1", "fecha");
    await runBonus("c1", "fecha");
    expect(row()?.status).toBe("pending");
    expect(bonusMock).not.toHaveBeenCalled();
  });

  it("sin tarjeta y sin nada pendiente, libera el cupo", async () => {
    lookupMock.mockResolvedValue(null);
    claimBonus("c1", "fecha");
    await runBonus("c1", "fecha");
    expect(row()).toBeUndefined();
    expect(claimBonus("c1", "fecha")).toBe(true);
  });

  it("un error deja el intento contado y pendiente", async () => {
    bonusMock.mockRejectedValue(new LoyaltyApiError("unavailable", 0));
    claimBonus("c1", "fecha");
    await runBonus("c1", "fecha");
    expect(row()).toMatchObject({ status: "pending", attempts: 1, last_error: "unavailable" });
  });

  it("runBonus no lanza aunque lookup lance", async () => {
    lookupMock.mockRejectedValue(new Error("boom"));
    claimBonus("c1", "fecha");
    await expect(runBonus("c1", "fecha")).resolves.toBeUndefined();
    expect(row()).toMatchObject({ status: "pending", attempts: 1, last_error: "internal_error" });
    await expect(runBonus("sin-fila", "fecha")).resolves.toBeUndefined();
  });
});

describe("runDueBonuses", () => {
  it("reintenta lo pendiente y cuenta", async () => {
    claimBonus("c1", "fecha");
    expect(await runDueBonuses()).toEqual({ done: 1, pending: 0, failed: 0 });
    expect(row()?.status).toBe("done");
  });

  it("más de 72 horas pasa a failed", async () => {
    claimBonus("c1", "fecha");
    const later = new Date(Date.parse(row()!.created_at) + 73 * 3600_000);
    expect(await runDueBonuses(later)).toEqual({ done: 0, pending: 0, failed: 1 });
    expect(row()?.status).toBe("failed");
    expect(bonusMock).not.toHaveBeenCalled();
  });
});
