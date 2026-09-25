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
  it("prints the digital QR and the Spanish caption", async () => {
    const c = card(await buildSheetHtml(order("es"), { digitalCardUrl: CARD_URL }));
    expect(c).toContain(`src="${await qrSvgDataUri(CARD_URL)}"`);
    expect(c).toContain("Escanea para abrir tu sorpresa");
    expect(c).not.toContain(getQrWebsiteDataUri());
  });
  it("uses the English caption for English orders", async () => {
    const c = card(await buildSheetHtml(order("en"), { digitalCardUrl: CARD_URL }));
    expect(c).toContain("Scan to open your surprise");
  });
  it("keeps the website QR and no caption without one", async () => {
    const c = card(await buildSheetHtml(order("es")));
    expect(c).toContain(`src="${getQrWebsiteDataUri()}"`);
    expect(c).not.toContain("qr-caption");
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
    const c = card(await buildOrderSheetHtml(order("es")));
    expect(c).toContain(`src="${await qrSvgDataUri(CARD_URL)}"`);
  });
  it("falls back to the website QR otherwise", async () => {
    const c = card(await buildOrderSheetHtml(order("es")));
    expect(c).toContain(`src="${getQrWebsiteDataUri()}"`);
  });
});
