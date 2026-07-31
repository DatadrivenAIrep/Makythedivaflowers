import { describe, it, expect } from "vitest";
import { draftToRow, rowToDraft, rowToDraftDetail } from "@/lib/draft-row";
import type { DraftPayload } from "@/types/draft";

const payload: DraftPayload = {
  version: 1,
  channel: "phone",
  customer: { name: "Ana", phone: "5165550100", email: "", messagingChannel: "sms" },
  fulfillment: {
    method: "delivery",
    recipient: { name: "Lola", phone: "5165550199" },
    address: { street1: "1 A", city: "Albertson", state: "NY", zip: "11507", country: "US" },
    window: { date: "2099-01-01", slot: "midday" },
    cardMessage: "",
  },
  lines: [{ kind: "custom", title: "Rosas", priceCents: 5000, qty: 2 }],
  override: {},
  giftCardCode: "",
  payment: { status: "pending" },
};

describe("draft-row mapping", () => {
  it("round-trips a draft through the row shape", () => {
    const row = draftToRow({
      id: "dr_1",
      label: "Ana",
      payload,
      itemCount: 2,
      totalCents: 10000,
      takenBy: "maky",
      createdAt: "2026-07-31T00:00:00Z",
      updatedAt: "2026-07-31T00:00:00Z",
    });
    expect(row.payload_json).toBe(JSON.stringify(payload));

    const meta = rowToDraft(row);
    expect(meta).toEqual({
      id: "dr_1",
      label: "Ana",
      itemCount: 2,
      totalCents: 10000,
      takenBy: "maky",
      createdAt: "2026-07-31T00:00:00Z",
      updatedAt: "2026-07-31T00:00:00Z",
    });

    const detail = rowToDraftDetail(row);
    expect(detail.payload).toEqual(payload);
    expect(detail.label).toBe("Ana");
  });

  it("maps a null taken_by to undefined", () => {
    const row = draftToRow({
      id: "dr_2",
      label: "",
      payload,
      itemCount: 0,
      totalCents: 0,
      takenBy: undefined,
      createdAt: "2026-07-31T00:00:00Z",
      updatedAt: "2026-07-31T00:00:00Z",
    });
    expect(row.taken_by).toBeNull();
    expect(rowToDraft(row).takenBy).toBeUndefined();
  });
});
