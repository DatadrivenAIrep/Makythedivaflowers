import { describe, expect, it } from "vitest";
import { PRODUCTS } from "@/data/products";
import { productMetaTitle, productMetaDescription } from "@/lib/seo/product-meta";
import { productDetailBlocks, productRichDescription, productFaq } from "@/lib/seo/product-detail";
import { namesFlower, headlineFlowers } from "@/lib/seo/flowers";

/**
 * Whole-catalog sweep, both locales, every rule at once.
 *
 * Product SEO defects kept surfacing one page at a time because nothing checked
 * the catalog as a whole — a bad way to find out. This runs every rule against
 * every active product so a regression names itself instead of waiting to be
 * spotted on a page someone happens to open.
 *
 * `scripts/audit-product-seo.ts` prints the same findings grouped, for when a
 * failure needs eyeballing.
 */
const ACTIVE = PRODUCTS.filter((p) => p.active && !p.giftExtra);
const LOCALES = ["en", "es"] as const;
const NEEDS_NOTICE =
  /\b(24|48|72)\s*(hours|horas)\b|hours? ahead|reserva\s+con|reserve at least|por encargo|made to order/i;

/**
 * Titles whose human-written descriptor names a colour or style but no flower —
 * "Angel's Touch — All-White Arrangement". Injecting stems into these produced
 * worse copy than leaving them ("Grand White & Green Phalaenopsis & Cymbidium
 * Orchid Arrangement"), so the human wording stands.
 */
const HUMAN_DESCRIPTOR_NO_FLOWER = new Set([
  "ivory-and-emerald", "sunburst-garden", "rainforest-rhapsody", "katsobad", "angels-touch",
]);

describe("product SEO — full catalog", () => {
  for (const locale of LOCALES) {
    it(`${locale}: titles are unique, branded once, and name the town`, () => {
      const titles = ACTIVE.map((p) => productMetaTitle(p, locale));
      expect(new Set(titles).size).toBe(titles.length);
      for (const [i, t] of titles.entries()) {
        expect(t.match(/Diva Flowers/g)?.length, t).toBe(1);
        expect(t.includes("Albertson, NY"), t).toBe(true);
        expect(t.length, `${ACTIVE[i].slug}: ${t}`).toBeLessThanOrEqual(95);
      }
    });

    it(`${locale}: no title repeats a word or stacks three em dashes`, () => {
      for (const p of ACTIVE) {
        const t = productMetaTitle(p, locale);
        // Caught "Phalaenopsis Orchid & Orchid" and
        // "Designer's Choice — Maky — Mixed Arrangement — Diva Flowers".
        expect(/(\b[\wÁÉÍÓÚáéíóúñ]+\b)[\s—|·-]+\1\b/i.test(t), t).toBe(false);
        expect(/—[^—]*—[^—]*—/.test(t), t).toBe(false);
      }
    });

    it(`${locale}: every title says what the product is`, () => {
      const bare = ACTIVE.filter((p) => {
        const t = productMetaTitle(p, locale);
        const hasType =
          /bouquet|arrangement|basket|vase|plant|subscription|ramo|arreglo|cesta|jarrón|planta|suscripción/i.test(t);
        return !namesFlower(t, locale) && !hasType;
      }).map((p) => p.slug);
      expect(bare, `neither flower nor product type: ${bare.join(", ")}`).toEqual([]);
    });

    it(`${locale}: titles name the flower whenever the copy does`, () => {
      const missing = ACTIVE.filter(
        (p) =>
          headlineFlowers(`${p.description.en} ${p.blurb.en}`).length &&
          !namesFlower(productMetaTitle(p, locale), locale) &&
          !HUMAN_DESCRIPTOR_NO_FLOWER.has(p.slug),
      ).map((p) => p.slug);
      expect(missing, `flowerless title: ${missing.join(", ")}`).toEqual([]);
    });

    it(`${locale}: copy clears 150 words and meta stays under 320 chars`, () => {
      for (const p of ACTIVE) {
        expect(productRichDescription(p, locale).split(/\s+/).length, p.slug).toBeGreaterThan(150);
        const d = productMetaDescription(p, locale);
        expect(d.length, p.slug).toBeLessThanOrEqual(320);
        expect(/\.\s*\.|\s{2,}/.test(d), `${p.slug}: broken punctuation`).toBe(false);
      }
    });

    it(`${locale}: nothing promises same-day against its own copy`, () => {
      for (const p of ACTIVE) {
        const body = productDetailBlocks(p, locale).find((b) => b.key === "delivery")!.body;
        const today = /goes out today|sale hoy mismo/.test(body);
        expect(today, `${p.slug} delivery line vs tag`).toBe(p.tags.includes("same-day"));
        if (today) {
          expect(
            NEEDS_NOTICE.test(`${p.description[locale]} ${p.blurb[locale]}`),
            `${p.slug}: promises today but its copy asks for lead time`,
          ).toBe(false);
        }
      }
    });
  }

  it("English and Spanish never render the same string", () => {
    for (const p of ACTIVE) {
      expect(productMetaTitle(p, "en"), p.slug).not.toBe(productMetaTitle(p, "es"));
      const en = productDetailBlocks(p, "en").map((b) => b.body).join(" ");
      const es = productDetailBlocks(p, "es").map((b) => b.body).join(" ");
      expect(es, p.slug).not.toBe(en);
    }
  });
});

describe("product FAQ", () => {
  for (const locale of LOCALES) {
    it(`${locale}: every product answers the pre-purchase questions`, () => {
      for (const p of ACTIVE) {
        const faq = productFaq(p, locale);
        expect(faq.length, p.slug).toBeGreaterThanOrEqual(3);
        for (const f of faq) {
          expect(f.q.length, `${p.slug}: empty question`).toBeGreaterThan(8);
          expect(f.a.split(/\s+/).length, `${p.slug}: thin answer`).toBeGreaterThan(12);
        }
      }
    });

    it(`${locale}: the same-day answer never contradicts the tag`, () => {
      for (const p of ACTIVE) {
        const a = productFaq(p, locale).find((f) => /same-day|mismo día/i.test(f.q))!.a;
        const yes = /^Yes\.|^Sí\./.test(a);
        expect(yes, `${p.slug}: FAQ says ${yes} but tag says ${p.tags.includes("same-day")}`)
          .toBe(p.tags.includes("same-day"));
      }
    });
  }

  it("does not claim FAQPage markup we deliberately do not emit", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("components/product/PdpFaq.tsx", "utf8"),
    );
    // Strip comments first — the file's own doc block explains why FAQPage is
    // absent, and matching that is how this test failed the first time.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/application\/ld\+json|FAQPage/);
  });
});
