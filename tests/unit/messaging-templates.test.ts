import { describe, it, expect } from "vitest";
import { renderSmsBody, whatsappContentVars, type TemplateVars } from "@/lib/messaging-templates";

const vars: TemplateVars = {
  recipient_name: "Lola",
  total: "$205.51",
  window: "Sat May 17 · afternoon (12–4 pm)",
  link: "https://buy.stripe.com/test_abc123",
  shop_phone: "(516) 484-3456",
};

describe("renderSmsBody", () => {
  it("renders order_received in English", () => {
    const body = renderSmsBody("order_received", "en", vars);
    expect(body).toContain("Hi Lola");
    expect(body).toContain("$205.51");
    expect(body).toContain("(516) 484-3456");
  });

  it("renders order_received in Spanish", () => {
    const body = renderSmsBody("order_received", "es", vars);
    expect(body).toContain("Hola Lola");
    expect(body).toContain("recibió tu pedido");
  });

  it("renders payment_link with the URL", () => {
    const body = renderSmsBody("payment_link", "en", vars);
    expect(body).toContain("buy.stripe.com/test_abc123");
  });

  it("renders payment_confirmed in Spanish", () => {
    const body = renderSmsBody("payment_confirmed", "es", vars);
    expect(body).toContain("¡Gracias Lola");
    expect(body).toContain("Recibimos tu pago");
  });

  it("keeps SMS bodies under 160 chars in English with realistic vars", () => {
    expect(renderSmsBody("order_received", "en", vars).length).toBeLessThanOrEqual(160);
    expect(renderSmsBody("payment_link", "en", vars).length).toBeLessThanOrEqual(160);
    expect(renderSmsBody("payment_confirmed", "en", vars).length).toBeLessThanOrEqual(160);
  });
});

describe("whatsappContentVars", () => {
  it("returns numbered slots for order_received", () => {
    const slots = whatsappContentVars("order_received", vars);
    expect(slots["1"]).toBe("Lola");
    expect(slots["2"]).toBe("$205.51");
    expect(slots["3"]).toBe("Sat May 17 · afternoon (12–4 pm)");
    expect(slots["4"]).toBe("(516) 484-3456");
  });

  it("returns numbered slots for payment_link", () => {
    const slots = whatsappContentVars("payment_link", vars);
    expect(slots["1"]).toBe("Lola");
    expect(slots["2"]).toBe("$205.51");
    expect(slots["3"]).toBe("https://buy.stripe.com/test_abc123");
  });

  it("returns numbered slots for payment_confirmed", () => {
    const slots = whatsappContentVars("payment_confirmed", vars);
    expect(slots["1"]).toBe("Lola");
    expect(slots["2"]).toBe("Sat May 17 · afternoon (12–4 pm)");
  });
});
