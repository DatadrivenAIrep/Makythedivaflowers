import { it } from "vitest";
import { renderOrderPdf } from "@/lib/print-render";
import { writeFileSync } from "node:fs";

it("render sample for visual inspection", async () => {
  const order = {
    id: "do_sample_es01",
    locale: "es" as const,
    lines: [
      { productId: "p-arr-b1-01", variantId: "standard", addOnIds: ["candles"], qty: 1 },
    ],
    contact: { email: "carla@example.com", phone: "5165551234" },
    totals: { subtotalCents: 19100, deliveryCents: 0, taxCents: 1647, totalCents: 20747 },
    status: "paid" as const,
    createdAt: "2026-05-08T15:30:00.000Z",
    delivery: {
      method: "pickup" as const,
      recipient: { name: "Lola Cardona", phone: "5165550101" },
      window: { date: "2026-05-15", slot: "midday" as const },
      cardMessage: "Feliz cumpleaños mamá",
    },
  };
  const pdf = await renderOrderPdf(order);
  writeFileSync("/tmp/maky-print-sample-es.pdf", pdf);
  console.log("size=" + pdf.length);
});
