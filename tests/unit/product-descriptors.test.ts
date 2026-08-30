import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/data/products";
import { extractFlowers, headlineFlowers, joinFlowers } from "@/lib/seo/flowers";
import { productDescriptor } from "@/lib/seo/product-descriptors";
import { productMetaTitle } from "@/lib/seo/product-meta";
import { productDetailBlocks, productRichDescription } from "@/lib/seo/product-detail";

// giftExtra items are add-ons (a vase upgrade), not standalone products —
// they are excluded from the sitemap and the Merchant feed too.
const ACTIVE = PRODUCTS.filter((p) => p.active && !p.giftExtra);
const LOCALES = ["en", "es"] as const;

describe("flower extraction", () => {
  it("prefers the longest name — garden rose, not rose", () => {
    const hits = extractFlowers("twenty-four red garden roses with eucalyptus");
    expect(hits.map((h) => h.label.en)).toContain("Garden Rose");
    expect(hits.map((h) => h.label.en)).not.toContain("Rose");
  });

  it("keeps greenery out of headline stems but not out of the ingredient list", () => {
    const text = "purple lisianthus, white anemones, and silver dusty miller";
    expect(headlineFlowers(text).map((h) => h.label.en)).toEqual(["Lisianthus", "Anemone"]);
    expect(extractFlowers(text).map((h) => h.label.en)).toContain("Dusty Miller");
  });

  it("factors out a shared head noun instead of repeating it", () => {
    const hits = headlineFlowers("phalaenopsis orchids and green cymbidium orchids");
    expect(joinFlowers(hits, "en")).toBe("Phalaenopsis & Cymbidium Orchid");
    expect(joinFlowers(hits, "es")).toBe("Orquídea Phalaenopsis y Cymbidium");
  });
});

describe("product titles", () => {
  // Uniqueness, town, keyword coverage and length live in
  // tests/unit/product-seo-audit.test.ts, which checks the whole catalog in
  // both locales using the real flower vocabulary. Hand-rolled keyword regexes
  // here kept producing false failures ("Lirios para Lottie" is a lily) — one
  // locale-aware checker beats two that disagree.
  it("keeps the brand last, exactly once", () => {
    for (const locale of LOCALES) {
      for (const p of ACTIVE) {
        const t = productMetaTitle(p, locale);
        expect(t.match(/Diva Flowers/g)?.length, t).toBe(1);
        // Regression: splitting on "|" reordered em-dash titles into
        // "Abundant Table — Diva Flowers — Garden Rose Arrangement".
        expect(t.indexOf("Diva Flowers"), t).toBeGreaterThan(t.indexOf("—"));
      }
    }
  });

  it("leaves already-descriptive titles alone rather than doubling them", () => {
    const dozen = ACTIVE.find((p) => /Dozen/i.test(p.seo.title.en));
    if (dozen) expect(productMetaTitle(dozen, "en")).not.toMatch(/Rose.*Rose/);
  });
});

describe("product detail depth", () => {
  for (const locale of LOCALES) {
    it(`${locale}: every product clears the competitor's 205-word median`, () => {
      const counts = ACTIVE.map((p) => productRichDescription(p, locale).split(/\s+/).length);
      const median = counts.sort((a, b) => a - b)[counts.length >> 1];
      expect(median).toBeGreaterThan(205);
      // And no page is left thin.
      expect(Math.min(...counts)).toBeGreaterThan(120);
    });

    it(`${locale}: blocks are localised, not English in both`, () => {
      const p = ACTIVE[0];
      const en = productDetailBlocks(p, "en").map((b) => b.body).join(" ");
      const es = productDetailBlocks(p, "es").map((b) => b.body).join(" ");
      expect(es).not.toBe(en);
    });
  }

  it("quotes real variant prices, not placeholders", () => {
    const p = ACTIVE.find((x) => !x.quoteOnly && x.variants.length > 1)!;
    const sizes = productDetailBlocks(p, "en").find((b) => b.key === "sizes")!.body;
    for (const v of p.variants) {
      expect(sizes).toContain(`$${(v.priceCents / 100).toFixed(0)}`);
    }
  });

  it("never promises same-day on a product not tagged for it", () => {
    for (const p of ACTIVE) {
      const delivery = productDetailBlocks(p, "en").find((b) => b.key === "delivery")!.body;
      expect(/goes out today/.test(delivery)).toBe(p.tags.includes("same-day"));
    }
  });

  it("omits the sizes block for quote-only pieces that have no public price", () => {
    const quote = ACTIVE.find((p) => p.quoteOnly);
    if (quote) {
      expect(productDetailBlocks(quote, "en").some((b) => b.key === "sizes")).toBe(false);
    }
  });
});

describe("same-day tag agrees with the product's own copy", () => {
  /**
   * The `same-day` tag drives the meta description, the delivery block and the
   * Merchant feed's handling time. "Hundred Roses Vase" was tagged same-day
   * while its own description read "reserve at least 24 hours ahead" — so the
   * page promised delivery today directly beneath copy asking for a day's
   * notice. You cannot hand-build a hundred roses in an afternoon; the tag was
   * simply wrong, and trusting it propagated the error to three surfaces.
   */
  const NEEDS_NOTICE =
    /\b(24|48|72)\s*(hours|horas)\b|hours? ahead|d[ií]as? de antelaci[oó]n|con\s+\d+\s+horas|reserva\s+con|reserve at least|made to order|por encargo/i;

  it("no product promises same-day while its copy asks for notice", () => {
    const conflicted = ACTIVE.filter(
      (p) =>
        p.tags.includes("same-day") &&
        NEEDS_NOTICE.test(`${p.description.en} ${p.description.es} ${p.blurb.en} ${p.blurb.es}`),
    ).map((p) => p.slug);
    expect(
      conflicted,
      `tagged same-day but the copy asks for lead time: ${conflicted.join(", ")}`,
    ).toEqual([]);
  });

  it("the generated delivery line matches the tag on every product and locale", () => {
    for (const locale of LOCALES) {
      for (const p of ACTIVE) {
        const body = productDetailBlocks(p, locale).find((b) => b.key === "delivery")!.body;
        const promisesToday = /goes out today|sale hoy mismo/.test(body);
        expect(promisesToday, `${p.slug} (${locale})`).toBe(p.tags.includes("same-day"));
      }
    }
  });
});
