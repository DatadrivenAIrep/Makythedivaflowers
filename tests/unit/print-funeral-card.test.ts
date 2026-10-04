// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";
import { qrSvgDataUri } from "@/lib/digital-card-qr";

const CARD_URL = "https://makythedivaflowers.com/c/Ab3dE5fG";

// Scope to <body>: the CSS in <head> mentions class names too.
function body(html: string) {
  return html.slice(html.indexOf("<body>"));
}

// The message panel (third card), whatever its variant class.
function messagePanel(html: string) {
  const b = body(html);
  const start = b.indexOf('class="card-panel inside-msg');
  const next = b.indexOf('class="card-panel', start + 1);
  return b.slice(start, next === -1 ? undefined : next);
}

function worksheet(html: string) {
  const b = body(html);
  return b.slice(b.indexOf('class="worksheet"'), b.indexOf('class="card-row"'));
}

function order(over: Partial<Order> = {}): Order {
  return {
    id: "do_fun01",
    orderNumber: 1077,
    source: "phone",
    locale: "en",
    lines: [{ kind: "custom", title: "Standing spray", priceCents: 25000, qty: 1 }],
    contact: { name: "Ana", phone: "5165551234" },
    totals: { subtotalCents: 25000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 25000 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-10-04T15:30:00.000Z",
    updatedAt: "2026-10-04T15:30:00.000Z",
    fulfillment: {
      method: "delivery",
      recipient: { name: "Family of John Smith", phone: "5165550101" },
      address: { street1: "200 Willis Ave", city: "Mineola", state: "NY", zip: "11501", country: "US" },
      window: { date: "2026-10-05", slot: "morning" },
      cardMessage: "Forever in our hearts",
    },
    ...over,
  } as Order;
}

describe("funeral message card", () => {
  it("carries the message, the Maky wordmark and the shop contact", async () => {
    const msg = messagePanel(await buildSheetHtml(order({ funeral: true })));
    expect(msg).toContain("card-panel inside-msg funeral");
    expect(msg).toContain("Forever in our hearts");
    expect(msg).toContain("the diva flowers");
    expect(msg).toContain("516 484 3456");
    expect(msg).toContain("makythedivaflowers.com");
  });

  it("drops the pink flower ornaments", async () => {
    const msg = messagePanel(await buildSheetHtml(order({ funeral: true })));
    expect(msg).not.toContain("❀");
  });

  it("keeps the brand on the card when there is no message", async () => {
    const o = order({ funeral: true });
    delete o.fulfillment.cardMessage;
    const msg = messagePanel(await buildSheetHtml(o));
    expect(msg).toContain("the diva flowers");
    expect(msg).toContain("516 484 3456");
  });

  it("shows the digital-card QR inside the funeral design", async () => {
    const msg = messagePanel(await buildSheetHtml(order({ funeral: true }), { digitalCardUrl: CARD_URL }));
    expect(msg).toContain(`src="${await qrSvgDataUri(CARD_URL)}"`);
    expect(msg).not.toContain("Forever in our hearts");
    expect(msg).toContain("the diva flowers");
  });

  it("flags the worksheet so the workshop sees it is a funeral", async () => {
    expect(worksheet(await buildSheetHtml(order({ funeral: true })))).toContain("Funeral");
  });
});

describe("regular message card", () => {
  it("is unchanged: flower ornaments, no funeral variant, no contact footer", async () => {
    const html = await buildSheetHtml(order());
    const msg = messagePanel(html);
    expect(msg).toContain("❀");
    expect(msg).not.toContain("funeral");
    expect(msg).not.toContain("516 484 3456");
    expect(worksheet(html)).not.toContain("Funeral");
  });
});
