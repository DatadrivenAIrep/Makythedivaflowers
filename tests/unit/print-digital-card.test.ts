// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Order } from "@/types/order";
import { buildSheetHtml } from "@/lib/print-render-html";
import { buildOrderSheetHtml } from "@/lib/print-sheet";
import { qrSvgDataUri } from "@/lib/digital-card-qr";
import { getQrWebsiteDataUri } from "@/lib/print-styles";
import { closeDb, getDb } from "@/lib/db";
import { runMigrations } from "@/lib/db-migrate";
import { enableForOrder } from "@/lib/digital-cards";

const CARD_URL = "https://makythedivaflowers.com/c/Ab3dE5fG";

// Scope to the card row in <body>: the CSS in <head> mentions class names too.
function card(html: string) {
  const body = html.slice(html.indexOf("<body>"));
  return body.slice(body.indexOf('class="card-row"'));
}

// One panel of the tri-fold card, e.g. panel(html, "inside-msg").
function panel(html: string, cls: string) {
  const row = card(html);
  const start = row.indexOf(`class="card-panel ${cls}"`);
  const next = row.indexOf('class="card-panel', start + 1);
  return row.slice(start, next === -1 ? undefined : next);
}

function order(locale: "es" | "en", id = "do_dc01"): Order {
  return {
    id,
    orderNumber: 1042,
    source: "walk-in",
    locale,
    lines: [{ kind: "catalog", productId: "p-arr-b1-01", variantId: "standard", addOnIds: [], qty: 1 }],
    contact: { name: "Ana", email: "ana@example.com", phone: "5165551234" },
    totals: { subtotalCents: 40000, deliveryCents: 0, discountCents: 0, tipCents: 0, taxCents: 0, totalCents: 40000 },
    status: "pending",
    paymentStatus: "paid",
    createdAt: "2026-09-24T15:30:00.000Z",
    updatedAt: "2026-09-24T15:30:00.000Z",
    fulfillment: {
      method: "in-store",
      recipient: { name: "Raymond", phone: "5165550101" },
      cardMessage: "Feliz 50",
    },
  } as Order;
}

describe("buildSheetHtml with a digital card", () => {
  it("puts the digital QR and the Spanish caption in the message panel, instead of the message", async () => {
    const html = await buildSheetHtml(order("es"), { digitalCardUrl: CARD_URL });
    const msg = panel(html, "inside-msg");
    expect(msg).toContain(`src="${await qrSvgDataUri(CARD_URL)}"`);
    expect(msg).toContain("Escanea para abrir tu sorpresa");
    expect(msg).not.toContain("Feliz 50");
  });
  it("keeps the website QR on the cover, with no caption", async () => {
    const html = await buildSheetHtml(order("es"), { digitalCardUrl: CARD_URL });
    const cover = panel(html, "brand-cover");
    expect(cover).toContain(`src="${getQrWebsiteDataUri()}"`);
    expect(cover).not.toContain(await qrSvgDataUri(CARD_URL));
    expect(cover).not.toContain("sorpresa");
  });
  it("uses the English caption for English orders", async () => {
    const msg = panel(await buildSheetHtml(order("en"), { digitalCardUrl: CARD_URL }), "inside-msg");
    expect(msg).toContain("Scan to open your surprise");
  });
  it("prints the customer's message and no digital QR without one", async () => {
    const html = await buildSheetHtml(order("es"));
    const msg = panel(html, "inside-msg");
    expect(msg).toContain("Feliz 50");
    expect(msg).not.toContain("msg-qr");
    expect(panel(html, "brand-cover")).toContain(`src="${getQrWebsiteDataUri()}"`);
  });
});

describe("buildOrderSheetHtml", () => {
  beforeEach(() => {
    vi.stubEnv("SQLITE_FILE", ":memory:");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://makythedivaflowers.com");
    runMigrations();
    getDb().prepare(
      `INSERT INTO orders (id, locale, source, recipient_name, recipient_phone, contact_phone,
         fulfillment_method, window_date, window_slot, lines_json, subtotal_cents, delivery_cents,
         tax_cents, total_cents, fulfillment_status, payment_status, created_at, updated_at)
       VALUES ('do_dc01', 'es', 'walk-in', 'Raymond', '555', '555', 'in-store', NULL, NULL, '[]', 0,0,0,0,
         'pending', 'paid', '2026-09-24T15:30:00Z', '2026-09-24T15:30:00Z')`,
    ).run();
  });
  afterEach(() => { closeDb(); vi.unstubAllEnvs(); });

  it("uses the order's digital card when enabled", async () => {
    enableForOrder("do_dc01", () => "Ab3dE5fG");
    const msg = panel(await buildOrderSheetHtml(order("es")), "inside-msg");
    expect(msg).toContain(`src="${await qrSvgDataUri(CARD_URL)}"`);
  });
  it("prints the customer's message otherwise", async () => {
    const msg = panel(await buildOrderSheetHtml(order("es")), "inside-msg");
    expect(msg).toContain("Feliz 50");
  });
});
