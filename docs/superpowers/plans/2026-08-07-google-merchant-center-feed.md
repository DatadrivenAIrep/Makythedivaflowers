# Google Merchant Center Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a live product feed, a returns-policy page, and aligned structured data so Maky The Diva Flowers can be approved for Google Merchant Center free listings.

**Architecture:** Testable logic lives in pure functions in `lib/` (`buildMerchantFeed`, `buildProductJsonLd`); a Next.js Route Handler at `app/merchant-feed.xml/route.ts` serves the feed XML; a new `app/[locale]/legal/returns` page reuses the existing `LegalShell` + next-intl pattern. A single shared brand constant (`SITE.merchantName`) keeps the feed and structured data consistent.

**Tech Stack:** Next.js App Router (route handlers — read `node_modules/next/dist/docs/`), next-intl, TypeScript, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-07-google-merchant-center-feed-design.md`

**Conventions:** Run tests with `npx vitest run <path>`. Branch is `merchant-center-feed` (already created). Commit after each task.

---

### Task 1: Add shared merchant brand constant

**Files:**
- Modify: `data/site.ts` (the `SITE` object, near the `brand` field)

- [ ] **Step 1: Add `merchantName` to `SITE`**

In `data/site.ts`, inside the `SITE` object, add a `merchantName` field right after `brand`:

```ts
  brand: "Diva Flowers",
  merchantName: "Maky The Diva Flowers",
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (existing `tsconfig.tsbuildinfo` errors unrelated to this change are acceptable — compare against a clean run if unsure).

- [ ] **Step 3: Commit**

```bash
git add data/site.ts
git commit -m "feat(site): add merchantName constant for Merchant Center consistency"
```

---

### Task 2: Merchant feed builder (pure function) + tests

**Files:**
- Create: `lib/merchant-feed.ts`
- Test: `tests/unit/merchant-feed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/merchant-feed.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildMerchantFeed } from "@/lib/merchant-feed";
import type { Product } from "@/types/product";

const ORIGIN = "https://makythedivaflowers.com";

const fx = (over: Partial<Product>): Product => ({
  id: over.id ?? "p1",
  slug: over.slug ?? "test-arrangement",
  title: over.title ?? { en: "Test Arrangement", es: "Arreglo de Prueba" },
  category: over.category ?? "arrangements",
  blurb: { en: "", es: "" },
  description: over.description ?? { en: "A lovely test.", es: "Una prueba." },
  images: over.images ?? [{ src: "/products/test.jpg", alt: { en: "", es: "" }, aspect: "4/5" }],
  variants: over.variants ?? [
    { id: "standard", label: { en: "S", es: "S" }, priceCents: 19100 },
    { id: "lush", label: { en: "L", es: "L" }, priceCents: 25500 },
  ],
  tags: over.tags ?? [],
  occasions: over.occasions ?? [],
  colorFamily: over.colorFamily ?? [],
  active: over.active ?? true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...over,
});

describe("buildMerchantFeed", () => {
  it("includes only active products", () => {
    const feed = buildMerchantFeed([fx({ id: "a", active: true }), fx({ id: "b", slug: "b", active: false })], ORIGIN);
    expect(feed).toContain("<g:id>a</g:id>");
    expect(feed).not.toContain("<g:id>b</g:id>");
  });

  it("emits required attributes with the Standard (lowest) price", () => {
    const feed = buildMerchantFeed([fx({})], ORIGIN);
    expect(feed).toContain("<g:price>191.00 USD</g:price>");
    expect(feed).toContain("<g:availability>in_stock</g:availability>");
    expect(feed).toContain("<g:condition>new</g:condition>");
    expect(feed).toContain("<g:identifier_exists>no</g:identifier_exists>");
    expect(feed).toContain("Maky The Diva Flowers");
  });

  it("builds absolute link and image_link", () => {
    const feed = buildMerchantFeed([fx({ slug: "roses" })], ORIGIN);
    expect(feed).toContain(`<g:link><![CDATA[${ORIGIN}/en/product/roses]]></g:link>`);
    expect(feed).toContain(`${ORIGIN}/products/test.jpg`);
  });

  it("maps arrangements to Fresh Cut Flowers and omits category for gifts", () => {
    const feed = buildMerchantFeed(
      [fx({ id: "arr", category: "arrangements" }), fx({ id: "gift", slug: "g", category: "gifts" })],
      ORIGIN,
    );
    expect(feed).toContain("<g:google_product_category>6248</g:google_product_category>");
    // gift item present but without a google_product_category line
    const giftItem = feed.slice(feed.indexOf("<g:id>gift</g:id>"));
    expect(giftItem.slice(0, giftItem.indexOf("</item>"))).not.toContain("google_product_category");
  });

  it("XML-escapes ampersands in URLs and CDATA-wraps titles", () => {
    const feed = buildMerchantFeed([fx({ title: { en: "Milk & Honey", es: "x" } })], ORIGIN);
    expect(feed).toContain("<![CDATA[Milk & Honey]]>");
  });

  it("wraps the document in an rss/channel envelope", () => {
    const feed = buildMerchantFeed([fx({})], ORIGIN);
    expect(feed).toContain('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">');
    expect(feed).toContain("<channel>");
    expect(feed.trim().endsWith("</rss>")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/merchant-feed.test.ts`
Expected: FAIL — cannot resolve `@/lib/merchant-feed`.

- [ ] **Step 3: Write the implementation**

Create `lib/merchant-feed.ts`:

```ts
import type { Product, ProductCategory } from "@/types/product";
import { startingPriceCents } from "@/data/product-helpers";
import { SITE } from "@/data/site";

// Google product taxonomy IDs. Only categories we can map confidently are set;
// unmapped ones are omitted so Google auto-categorizes them.
const GOOGLE_CATEGORY: Partial<Record<ProductCategory, string>> = {
  arrangements: "6248", // Home & Garden > Decor > Flowers > Fresh Cut Flowers
  bouquets: "6248",
  sympathy: "6248",
  plants: "985", // Home & Garden > Plants
};

const PRODUCT_TYPE: Record<ProductCategory, string> = {
  arrangements: "Flowers > Arrangements",
  bouquets: "Flowers > Bouquets",
  sympathy: "Flowers > Sympathy",
  plants: "Plants",
  gifts: "Gifts",
  subscriptions: "Subscriptions",
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cdata(s: string): string {
  // Guard against a literal "]]>" sequence breaking the CDATA block.
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function priceUsd(cents: number): string {
  return `${(cents / 100).toFixed(2)} USD`;
}

export function buildItemXml(p: Product, origin: string): string {
  const link = `${origin}/en/product/${p.slug}`;
  const [first, ...rest] = p.images;
  const imageLink = first ? `${origin}${first.src}` : "";
  const gCat = GOOGLE_CATEGORY[p.category];

  const lines = [
    "  <item>",
    `    <g:id>${xmlEscape(p.id)}</g:id>`,
    `    <g:title>${cdata(p.title.en.slice(0, 150))}</g:title>`,
    `    <g:description>${cdata(p.description.en.slice(0, 5000))}</g:description>`,
    `    <g:link>${cdata(link)}</g:link>`,
    `    <g:image_link>${xmlEscape(imageLink)}</g:image_link>`,
    ...rest
      .slice(0, 10)
      .map((img) => `    <g:additional_image_link>${xmlEscape(origin + img.src)}</g:additional_image_link>`),
    `    <g:availability>in_stock</g:availability>`,
    `    <g:price>${priceUsd(startingPriceCents(p))}</g:price>`,
    `    <g:brand>${cdata(SITE.merchantName)}</g:brand>`,
    `    <g:condition>new</g:condition>`,
    `    <g:identifier_exists>no</g:identifier_exists>`,
    ...(gCat ? [`    <g:google_product_category>${gCat}</g:google_product_category>`] : []),
    `    <g:product_type>${cdata(PRODUCT_TYPE[p.category])}</g:product_type>`,
    "  </item>",
  ];
  return lines.join("\n");
}

export function buildMerchantFeed(products: Product[], origin: string): string {
  const items = products
    .filter((p) => p.active)
    .map((p) => buildItemXml(p, origin))
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    `    <title>${cdata(SITE.merchantName)}</title>`,
    `    <link>${xmlEscape(origin)}</link>`,
    "    <description>Fresh flowers, hand-built and delivered on Long Island.</description>",
    items,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/merchant-feed.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/merchant-feed.ts tests/unit/merchant-feed.test.ts
git commit -m "feat(merchant): add product feed builder with tests"
```

---

### Task 3: Feed route handler

**Files:**
- Create: `app/merchant-feed.xml/route.ts`
- Reference: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `.../09-revalidating.md`, `.../08-caching.md`

- [ ] **Step 1: Read the Next.js route-handler docs**

Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. Confirm the GET signature, how to return a non-JSON `Response`, and whether `export const revalidate` / `export const dynamic` are the current way to control caching in this Next version. If the doc contradicts the code below, follow the doc and adjust — the `Cache-Control` header alone is enough for Google's daily fetch even if `revalidate` behaves differently.

- [ ] **Step 2: Write the route handler**

Create `app/merchant-feed.xml/route.ts`:

```ts
import { PRODUCTS } from "@/data/products";
import { SITE } from "@/data/site";
import { buildMerchantFeed } from "@/lib/merchant-feed";

// Catalog is static data; cache the response and regenerate at most hourly.
export const revalidate = 3600;

export function GET() {
  const xml = buildMerchantFeed(PRODUCTS, SITE.url);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
```

- [ ] **Step 3: Verify the route serves valid XML and is not locale-rewritten**

Start the dev server (use the project's dev command / preview tooling), then:

Run: `curl -sS -D - http://localhost:3000/merchant-feed.xml -o /tmp/feed.xml | grep -i -E "HTTP/|content-type|location"`
Expected: `200`, `content-type: application/xml`, and **no** `location:` redirect to `/en/merchant-feed.xml`.

Run: `grep -c "<item>" /tmp/feed.xml`
Expected: a count in the ~90s (the active-product count; currently ~96).

Run: `head -5 /tmp/feed.xml`
Expected: XML declaration + `<rss ... xmlns:g=...>`.

- [ ] **Step 4: Commit**

```bash
git add app/merchant-feed.xml/route.ts
git commit -m "feat(merchant): serve product feed at /merchant-feed.xml"
```

---

### Task 4: Returns policy — i18n copy

**Files:**
- Modify: `messages/en.json` (add `legal.returns`; add `footer.legal.returns`)
- Modify: `messages/es.json` (add `legal.returns`; add `footer.legal.returns`)

> Note: this copy aligns with the existing `legal.terms.returns` DRAFT (perishable goods, no physical returns, replacement/refund on damage/error, 24h photo reporting). It is a working draft; the owner should have it reviewed for consumer-protection compliance, consistent with the existing convention.

- [ ] **Step 1: Add the `legal.returns` block to `messages/en.json`**

Inside the top-level `"legal"` object, after the `"terms"` block, add:

```json
"returns": {
  "page_title": "Returns & Refunds — Maky The Diva Flowers",
  "page_description": "Our freshness guarantee, how to report an issue, substitutions, cancellations, and how to reach us.",
  "title": "Returns & Refunds",
  "updated": "Last updated August 2026",
  "guarantee": {
    "heading": "Our Freshness Guarantee",
    "p1": "Every arrangement is hand-built the day it ships and inspected before it leaves our studio at {address}. Because flowers are perishable, we do not accept physical returns — but we stand behind every order. If your flowers arrive damaged, wilted, or materially different from what was ordered, we will replace the arrangement or issue a refund.",
    "p2": "Refunds and replacements are reviewed case by case and are generally limited to situations where the product arrived in significantly damaged condition, or was materially different from what was ordered, due to our error."
  },
  "reporting": {
    "heading": "Reporting a Problem",
    "p1": "Please contact us within 24 hours of delivery and include a photo of the arrangement as it arrived. Photos help us resolve your case quickly and improve the flowers we source.",
    "p2": "You can reach us by phone, text, or WhatsApp at {phone}, or by email at {email}. The fastest way to reach Maky is by text or WhatsApp."
  },
  "substitutions": {
    "heading": "Substitutions",
    "p1": "Flowers are a natural product and availability changes daily. When a specific stem, color, or container is unavailable, we may substitute it with one of equal or greater value while preserving the overall look, style, and color palette of the design you ordered.",
    "p2": "For arrangements built around a single signature flower, we will contact you before making a significant substitution whenever time allows."
  },
  "cancellations": {
    "heading": "Cancellations & Changes",
    "p1": "You may cancel or change an order at no charge up until it has been arranged. Our same-day cutoff is 2:00 PM local time: orders placed before then are eligible for same-day delivery, and any changes must reach us before the cutoff to be applied that day.",
    "p2": "Once an arrangement has been built and dispatched for delivery, it can no longer be cancelled, though our freshness guarantee above still applies."
  },
  "contact": {
    "heading": "Contact Us",
    "p1": "Maky The Diva Flowers · {address}. Call or text {phone}, message us on WhatsApp, or email {email}.",
    "p2": "We deliver across Albertson, Roslyn, Manhasset, Great Neck, Port Washington, and the surrounding Long Island, Queens, and western Suffolk areas."
  }
}
```

- [ ] **Step 2: Add the footer link label to `messages/en.json`**

Inside `"footer"` → `"legal"` (which already has `"privacy"` and `"terms"`), add:

```json
"returns": "Returns"
```

- [ ] **Step 3: Add the `legal.returns` block to `messages/es.json`**

Inside the top-level `"legal"` object, after the `"terms"` block, add:

```json
"returns": {
  "page_title": "Devoluciones y Reembolsos — Maky The Diva Flowers",
  "page_description": "Nuestra garantía de frescura, cómo reportar un problema, sustituciones, cancelaciones y cómo contactarnos.",
  "title": "Devoluciones y Reembolsos",
  "updated": "Última actualización: agosto de 2026",
  "guarantee": {
    "heading": "Nuestra Garantía de Frescura",
    "p1": "Cada arreglo se arma a mano el día que sale y se inspecciona antes de dejar nuestro estudio en {address}. Como las flores son perecederas, no aceptamos devoluciones físicas, pero respaldamos cada pedido. Si tus flores llegan dañadas, marchitas o notablemente distintas a lo ordenado, reemplazamos el arreglo o emitimos un reembolso.",
    "p2": "Los reembolsos y reemplazos se revisan caso por caso y suelen limitarse a situaciones en que el producto llegó en condiciones significativamente dañadas, o fue materialmente distinto de lo ordenado, por un error nuestro."
  },
  "reporting": {
    "heading": "Cómo Reportar un Problema",
    "p1": "Contáctanos dentro de las 24 horas posteriores a la entrega e incluye una foto del arreglo tal como llegó. Las fotos nos ayudan a resolver tu caso con rapidez y a mejorar las flores que seleccionamos.",
    "p2": "Puedes escribirnos por teléfono, texto o WhatsApp al {phone}, o por correo a {email}. La forma más rápida de contactar a Maky es por texto o WhatsApp."
  },
  "substitutions": {
    "heading": "Sustituciones",
    "p1": "Las flores son un producto natural y la disponibilidad cambia a diario. Cuando un tallo, color o contenedor específico no está disponible, podemos sustituirlo por otro de igual o mayor valor, conservando el aspecto, el estilo y la paleta de color del diseño que ordenaste.",
    "p2": "Para arreglos construidos en torno a una flor principal, te contactaremos antes de hacer una sustitución importante siempre que el tiempo lo permita."
  },
  "cancellations": {
    "heading": "Cancelaciones y Cambios",
    "p1": "Puedes cancelar o cambiar un pedido sin costo hasta que haya sido armado. Nuestro corte para el mismo día es a las 2:00 PM hora local: los pedidos hechos antes de esa hora son elegibles para entrega el mismo día, y los cambios deben llegarnos antes del corte para aplicarse ese día.",
    "p2": "Una vez que un arreglo ha sido armado y despachado para entrega, ya no puede cancelarse, aunque nuestra garantía de frescura anterior sigue vigente."
  },
  "contact": {
    "heading": "Contáctanos",
    "p1": "Maky The Diva Flowers · {address}. Llama o escribe al {phone}, contáctanos por WhatsApp, o envía un correo a {email}.",
    "p2": "Entregamos en Albertson, Roslyn, Manhasset, Great Neck, Port Washington y las zonas aledañas de Long Island, Queens y el oeste de Suffolk."
  }
}
```

- [ ] **Step 4: Add the footer link label to `messages/es.json`**

Inside `"footer"` → `"legal"`, add:

```json
"returns": "Devoluciones"
```

- [ ] **Step 5: Validate both JSON files parse**

Run: `node -e "require('./messages/en.json'); require('./messages/es.json'); console.log('ok')"`
Expected: `ok` (no JSON syntax error from a misplaced comma).

- [ ] **Step 6: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(legal): add returns policy copy (EN/ES)"
```

---

### Task 5: Returns page + footer link

**Files:**
- Create: `app/[locale]/legal/returns/page.tsx`
- Modify: `components/nav/Footer.tsx` (add link after the terms link, ~line 96)

- [ ] **Step 1: Create the returns page**

Create `app/[locale]/legal/returns/page.tsx` (mirrors `app/[locale]/legal/terms/page.tsx`):

```tsx
// app/[locale]/legal/returns/page.tsx
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { SITE } from "@/data/site";
import { formatAddressLine } from "@/lib/format";
import type { Locale } from "@/types/locale";

const SECTIONS = ["guarantee", "reporting", "substitutions", "cancellations", "contact"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.returns" });
  return {
    title: t("page_title"),
    description: t("page_description"),
    alternates: { languages: { en: "/en/legal/returns", es: "/es/legal/returns" } },
  };
}

export default async function ReturnsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal.returns" });
  const values = {
    address: formatAddressLine(SITE.address),
    email: SITE.email,
    phone: SITE.mobile.display,
  };
  const sections = SECTIONS.map((key) => ({
    heading: t(`${key}.heading`),
    body: [t(`${key}.p1`, values), t(`${key}.p2`, values)],
  }));
  return <LegalShell title={t("title")} updated={t("updated")} sections={sections} />;
}
```

- [ ] **Step 2: Add the footer link**

In `components/nav/Footer.tsx`, immediately after the terms `<Link>` (currently line 96), add:

```tsx
            <Link href={`/${locale}/legal/returns`} className="hover:text-bone transition-colors">{t("legal.returns")}</Link>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors related to these files.

- [ ] **Step 4: Verify both locales render and are linked**

With the dev server running:

Run: `curl -sS http://localhost:3000/en/legal/returns | grep -o "Our Freshness Guarantee"`
Expected: `Our Freshness Guarantee`

Run: `curl -sS http://localhost:3000/es/legal/returns | grep -o "Nuestra Garantía de Frescura"`
Expected: `Nuestra Garantía de Frescura`

Confirm the footer shows a "Returns" / "Devoluciones" link pointing to `/{locale}/legal/returns`.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/legal/returns/page.tsx" components/nav/Footer.tsx
git commit -m "feat(legal): add returns policy page and footer link"
```

---

### Task 6: Product JSON-LD builder (pure) + tests

**Files:**
- Create: `lib/product-jsonld.ts`
- Test: `tests/unit/product-jsonld.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-jsonld.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "@/lib/product-jsonld";
import type { Product } from "@/types/product";

const ORIGIN = "https://makythedivaflowers.com";

const fx = (over: Partial<Product> = {}): Product => ({
  id: "p1",
  slug: "roses",
  title: { en: "Roses", es: "Rosas" },
  category: "bouquets",
  blurb: { en: "", es: "" },
  description: { en: "Red roses.", es: "Rosas rojas." },
  images: [{ src: "/products/roses.jpg", alt: { en: "", es: "" }, aspect: "4/5" }],
  variants: [
    { id: "standard", label: { en: "S", es: "S" }, priceCents: 7900 },
    { id: "lush", label: { en: "L", es: "L" }, priceCents: 10500 },
  ],
  tags: [],
  occasions: [],
  colorFamily: [],
  active: true,
  seo: { title: { en: "", es: "" }, description: { en: "", es: "" } },
  ...over,
});

describe("buildProductJsonLd", () => {
  it("uses the merchant brand name", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.brand.name).toBe("Maky The Diva Flowers");
  });

  it("sets lowPrice to the Standard (lowest) variant", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.offers.lowPrice).toBe("79.00");
    expect(data.offers.priceCurrency).toBe("USD");
    expect(data.offers.itemCondition).toBe("https://schema.org/NewCondition");
  });

  it("emits absolute image URLs", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.image).toEqual([`${ORIGIN}/products/roses.jpg`]);
  });

  it("links a merchant return policy", () => {
    const data = buildProductJsonLd(fx(), "en", ORIGIN);
    expect(data.hasMerchantReturnPolicy.merchantReturnLink).toBe(`${ORIGIN}/en/legal/returns`);
    expect(data.hasMerchantReturnPolicy.applicableCountry).toBe("US");
  });

  it("marks inactive products out of stock", () => {
    const data = buildProductJsonLd(fx({ active: false }), "en", ORIGIN);
    expect(data.offers.availability).toBe("https://schema.org/OutOfStock");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-jsonld.test.ts`
Expected: FAIL — cannot resolve `@/lib/product-jsonld`.

- [ ] **Step 3: Write the implementation**

Create `lib/product-jsonld.ts`:

```ts
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { startingPriceCents } from "@/data/product-helpers";
import { SITE } from "@/data/site";

export function buildProductJsonLd(product: Product, locale: Locale, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title[locale],
    description: product.description[locale],
    image: product.images.map((i) => `${origin}${i.src}`),
    brand: { "@type": "Brand", name: SITE.merchantName },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: (startingPriceCents(product) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: product.active
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: `${origin}/${locale}/product/${product.slug}`,
    },
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "US",
      merchantReturnLink: `${origin}/en/legal/returns`,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-jsonld.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/product-jsonld.ts tests/unit/product-jsonld.test.ts
git commit -m "feat(seo): add product JSON-LD builder with return policy and merchant brand"
```

---

### Task 7: Wire structured-data components to the builder

**Files:**
- Modify: `components/product/PdpStructuredData.tsx`
- Modify: `components/mothers-day/MothersDayProductSchema.tsx:24`

- [ ] **Step 1: Replace PdpStructuredData body with the builder**

Rewrite `components/product/PdpStructuredData.tsx` to:

```tsx
import type { Product } from "@/types/product";
import type { Locale } from "@/types/locale";
import { buildProductJsonLd } from "@/lib/product-jsonld";

export function PdpStructuredData({
  product,
  locale,
  origin,
}: {
  product: Product;
  locale: Locale;
  origin: string;
}) {
  const data = buildProductJsonLd(product, locale, origin);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

- [ ] **Step 2: Align the Mother's Day schema brand**

In `components/mothers-day/MothersDayProductSchema.tsx` line 24, change:

```tsx
    brand: { "@type": "Brand", name: SITE.brand },
```

to:

```tsx
    brand: { "@type": "Brand", name: SITE.merchantName },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Verify the PDP emits the new JSON-LD**

With the dev server running, pick any active product slug (e.g. `a-thousand-heartbeats`):

Run: `curl -sS http://localhost:3000/en/product/a-thousand-heartbeats | grep -o "Maky The Diva Flowers" | head -1`
Expected: `Maky The Diva Flowers`

Run: `curl -sS http://localhost:3000/en/product/a-thousand-heartbeats | grep -o "MerchantReturnPolicy"`
Expected: `MerchantReturnPolicy`

- [ ] **Step 5: Commit**

```bash
git add components/product/PdpStructuredData.tsx components/mothers-day/MothersDayProductSchema.tsx
git commit -m "feat(seo): align PDP + Mother's Day structured data with feed (brand, condition, return policy)"
```

---

### Task 8: Full regression check

- [ ] **Step 1: Run the new unit tests together**

Run: `npx vitest run tests/unit/merchant-feed.test.ts tests/unit/product-jsonld.test.ts`
Expected: all PASS.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this branch (a pre-existing failing baseline is documented in memory `test-suite-preexisting-failures`; compare against base `main` before blaming this branch).

- [ ] **Step 3: Sanity-check the live feed shape once more**

Run: `curl -sS http://localhost:3000/merchant-feed.xml | grep -c "<item>"`
Expected: ~96 items, matching the active-product count.

---

## Post-implementation: owner tasks in Merchant Center (guided, no code)

These happen in Google's UI after this branch is deployed to `makythedivaflowers.com`:

1. **Verify + claim** the domain (via GTM `NEXT_PUBLIC_GTM_ID` or Search Console).
2. **Business info:** "Maky The Diva Flowers", 1077 Willis Ave, Albertson NY 11507, customer-service phone `516 851 2815`.
3. **Return policy:** set the window and link `https://makythedivaflowers.com/en/legal/returns`.
4. **Shipping:** create a local-delivery service covering `SITE.deliveryZones`.
5. **Tax:** New York state.
6. **Feed:** add a primary feed via scheduled fetch → `https://makythedivaflowers.com/merchant-feed.xml`, country US, language EN.
7. Submit for review; address any disapprovals (image quality, price mismatch, policy).

## Self-review notes

- **Spec coverage:** Piece 1 → Tasks 2–3; Piece 2 → Tasks 4–5; Piece 3 → Tasks 1, 6–7; owner tasks carried into the post-implementation section. ✅
- **Shared brand:** `SITE.merchantName` (Task 1) is the single source for both feed (Task 2) and JSON-LD (Task 6). Consistent naming across tasks. ✅
- **Function names consistent:** `buildMerchantFeed`/`buildItemXml`, `buildProductJsonLd` referenced identically in their tests and consumers. ✅
