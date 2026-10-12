import { describe, it, expect } from "vitest";
import { createTranslator } from "next-intl";
import es from "@/messages/es.json";
import en from "@/messages/en.json";

type T = (key: string, values?: Record<string, string | number>) => string;
const tr = (locale: "es" | "en"): T =>
  createTranslator({ locale, messages: (locale === "es" ? es : en) as Record<string, unknown>, namespace: "admin_metrics" } as never) as unknown as T;
const metrics = (m: unknown) => (m as { admin_metrics: Record<string, string> }).admin_metrics;

describe("admin_metrics plurals", () => {
  it("renders the singular for n = 1 and the plural otherwise (es)", () => {
    const t = tr("es");
    expect(t("insight_pending", { n: 1, amount: "$50" })).toBe("1 orden con pago pendiente ($50).");
    expect(t("insight_pending", { n: 7, amount: "$50" })).toBe("7 órdenes con pago pendiente ($50).");
    expect(t("insight_upcoming_dates", { n: 1 })).toBe("1 fecha importante en los próximos 7 días.");
    expect(t("insight_upcoming_dates", { n: 12 })).toBe("12 fechas importantes en los próximos 7 días.");
    expect(t("insight_at_risk", { n: 1 })).toBe("1 cliente que compraba seguido no vuelve hace 90+ días.");
    expect(t("insight_at_risk", { n: 14 })).toBe("14 clientes que compraban seguido no vuelven hace 90+ días.");
    expect(t("insight_holiday", { holiday: "Halloween", days: 1, amount: "$10" })).toContain("en 1 día.");
    expect(t("insight_holiday", { holiday: "Halloween", days: 19, amount: "$10" })).toContain("en 19 días.");
    expect(t("insight_holiday_today", { holiday: "Halloween", amount: "$10" })).toBe("¡Hoy es Halloween! El año pasado esa semana vendiste $10.");
    expect(t("upcoming_count", { count: 1 })).toBe("1 pedido");
    expect(t("upcoming_count", { count: 3 })).toBe("3 pedidos");
    expect(t("split_value", { n: 1, amount: "$9" })).toBe("1 cliente · $9");
    expect(t("at_risk_meta", { n: 1, amount: "$9" })).toBe("1 pedido · $9");
    expect(t("at_risk_more", { n: 1 })).toBe("y 1 más");
    expect(t("date_in_days", { n: 1 })).toBe("en 1 día");
    expect(t("date_in_days", { n: 4 })).toBe("en 4 días");
    expect(t("funeral_share_value", { pct: 5, n: 1 })).toBe("5% de ventas · 1 orden");
    expect(t("funeral_share_value", { pct: 5, n: 2 })).toBe("5% de ventas · 2 órdenes");
  });

  it("renders the singular for n = 1 and the plural otherwise (en)", () => {
    const t = tr("en");
    expect(t("insight_pending", { n: 1, amount: "$50" })).toBe("1 order awaiting payment ($50).");
    expect(t("insight_pending", { n: 7, amount: "$50" })).toBe("7 orders awaiting payment ($50).");
    expect(t("insight_upcoming_dates", { n: 1 })).toBe("1 important date in the next 7 days.");
    expect(t("insight_upcoming_dates", { n: 12 })).toBe("12 important dates in the next 7 days.");
    expect(t("insight_at_risk", { n: 1 })).toBe("1 regular customer hasn't ordered in 90+ days.");
    expect(t("insight_at_risk", { n: 14 })).toBe("14 regular customers haven't ordered in 90+ days.");
    expect(t("insight_holiday", { holiday: "Halloween", days: 1, amount: "$10" })).toContain("in 1 day.");
    expect(t("insight_holiday", { holiday: "Halloween", days: 19, amount: "$10" })).toContain("in 19 days.");
    expect(t("insight_holiday_today", { holiday: "Halloween", amount: "$10" })).toBe("Halloween is today! That week last year you sold $10.");
    expect(t("upcoming_count", { count: 1 })).toBe("1 order");
    expect(t("upcoming_count", { count: 3 })).toBe("3 orders");
    expect(t("split_value", { n: 1, amount: "$9" })).toBe("1 customer · $9");
    expect(t("at_risk_meta", { n: 1, amount: "$9" })).toBe("1 order · $9");
    expect(t("at_risk_more", { n: 1 })).toBe("and 1 more");
    expect(t("date_in_days", { n: 1 })).toBe("in 1 day");
    expect(t("date_in_days", { n: 4 })).toBe("in 4 days");
    expect(t("funeral_share_value", { pct: 5, n: 1 })).toBe("5% of sales · 1 order");
    expect(t("funeral_share_value", { pct: 5, n: 2 })).toBe("5% of sales · 2 orders");
  });

  it("no longer carries the retired _one key", () => {
    expect(metrics(es).insight_upcoming_dates_one).toBeUndefined();
    expect(metrics(en).insight_upcoming_dates_one).toBeUndefined();
  });
});
