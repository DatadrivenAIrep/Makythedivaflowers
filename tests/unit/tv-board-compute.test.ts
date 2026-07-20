import { describe, it, expect } from "vitest";
import { computeBoard } from "@/lib/tv-board";
import { makeOrder } from "../factories/order";

const NOW = new Date("2026-07-20T14:15:00Z"); // 10:15 ET
const deps = { now: NOW, resolveThumb: () => "/x.jpg", resolveLabel: () => "Ramo" };

describe("computeBoard", () => {
  it("includes only paid pending/preparing orders scheduled today in `todo`", () => {
    const orders = [
      makeOrder({ id: "paidPending", windowDate: "2026-07-20", paymentStatus: "paid", status: "pending" }),
      makeOrder({ id: "unpaid", windowDate: "2026-07-20", paymentStatus: "pending", status: "pending" }),
      makeOrder({ id: "delivered", windowDate: "2026-07-20", paymentStatus: "paid", status: "delivered" }),
      makeOrder({ id: "otherDay", windowDate: "2026-07-21", paymentStatus: "paid", status: "pending" }),
    ];
    const board = computeBoard(orders, deps);
    expect(board.todo.map((c) => c.orderId)).toEqual(["paidPending"]);
  });

  it("sorts todo by slot start then delivery zone rank", () => {
    const orders = [
      makeOrder({ id: "evening", windowDate: "2026-07-20", slot: "evening", zip: "11576" }),
      makeOrder({ id: "morningFar", windowDate: "2026-07-20", slot: "morning", zip: "11030" }),
      makeOrder({ id: "morningNear", windowDate: "2026-07-20", slot: "morning", zip: "11507" }),
    ];
    const ids = computeBoard(orders, deps).todo.map((c) => c.orderId);
    // both morning first; within morning, nearer zone (lower rank) first
    expect(ids[0]).toBe(ids.includes("morningNear") ? "morningNear" : ids[0]);
    expect(ids[2]).toBe("evening");
    expect(ids.slice(0, 2).sort()).toEqual(["morningFar", "morningNear"]);
  });

  it("computes countdown + urgency per card", () => {
    const orders = [makeOrder({ id: "m", windowDate: "2026-07-20", slot: "midday" })];
    const card = computeBoard(orders, deps).todo[0];
    expect(card.minutesUntil).toBe(105);
    expect(card.urgency).toBe("amber");
  });

  it("surfaces card message, designer notes, source, thumb and label", () => {
    const orders = [
      makeOrder({ id: "n", windowDate: "2026-07-20", source: "whatsapp", cardMessage: "Feliz día", designerNotes: "pasteles" , method: "delivery"}),
    ];
    const card = computeBoard(orders, { now: NOW, resolveThumb: () => null, resolveLabel: () => "Designer's Choice" }).todo[0];
    expect(card.source).toBe("whatsapp");
    expect(card.hasCardMessage).toBe(true);
    expect(card.hasDesignerNotes).toBe(true);
    expect(card.thumb).toBeNull();
    expect(card.productLabel).toBe("Designer's Choice");
  });

  it("builds enRuta, deliveredToday and tomorrow counts", () => {
    const orders = [
      makeOrder({ id: "r1", windowDate: "2026-07-20", status: "out-for-delivery", updatedAt: "2026-07-20T13:00:00Z" }),
      makeOrder({ id: "d1", windowDate: "2026-07-20", status: "delivered" }),
      makeOrder({ id: "d2", windowDate: "2026-07-20", status: "delivered" }),
      makeOrder({ id: "t1", windowDate: "2026-07-21", slot: "morning" }),
      makeOrder({ id: "t2", windowDate: "2026-07-21", slot: "morning" }),
      makeOrder({ id: "t3", windowDate: "2026-07-21", slot: "evening" }),
    ];
    const board = computeBoard(orders, deps);
    expect(board.enRuta.map((r) => r.orderId)).toEqual(["r1"]);
    expect(board.deliveredToday).toBe(2);
    expect(board.tomorrow.total).toBe(3);
    expect(board.tomorrow.bySlot.morning).toBe(2);
    expect(board.tomorrow.bySlot.evening).toBe(1);
  });
});
