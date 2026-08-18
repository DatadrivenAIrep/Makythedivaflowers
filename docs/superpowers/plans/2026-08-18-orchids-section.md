# Sección de orquídeas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `/orchids` — una página editorial de seis bloques que vende phalaenopsis vivas — más un producto comprable de dos variantes ($65 un tallo, $85 dos tallos), y limpiar las dos entradas de catálogo que hoy dicen ser orquídeas y no lo son.

**Architecture:** Sigue el patrón de `/corsages-boutonnieres`: `app/[locale]/orchids/page.tsx` solo compone; cada bloque es un server component async en `components/orchids/` que recibe `locale` y lee su texto de `getTranslations("orchids")`. Los datos de cuidado viven en `data/orchid-care.ts`; el producto vive en `data/products.ts` como cualquier otro. Solo `OrchidsSizes` importa el producto, para que los precios no se dupliquen en el texto.

**Tech Stack:** Next.js (App Router, RSC), next-intl, Tailwind con tokens de marca del proyecto, Vitest + Testing Library, cwebp/qlmanage para imágenes.

**Spec:** `docs/superpowers/specs/2026-08-18-orchids-section-design.md`

**Rama:** `feat/orchids-section` (ya creada, ya tiene el commit del spec)

---

## Notas para quien ejecuta

**No conoces este repo. Tres cosas que te van a morder si no las lees:**

1. **Este no es el Next.js que conoces.** El repo trae `AGENTS.md` en la raíz avisando que hay breaking changes respecto a lo que sabes. Antes de escribir cualquier cosa de routing o metadata, lee la guía correspondiente en `node_modules/next/dist/docs/`. El middleware, por ejemplo, se llama `proxy.ts`, no `middleware.ts`.

2. **`npm test` completo tiene ~7 fallos preexistentes** (spawn de Chromium, y checkout/preview) que también fallan en `main` sin estos cambios. Corre siempre el archivo específico con `-t` o por ruta. Si vas a correr la suite completa, compara contra la base antes de culpar a tu cambio.

3. **Los precios del catálogo son antes de impuesto.** El 8.625% se suma en el checkout. $65 y $85 se guardan como `6500` y `8500`.

**Comando de test:** `npm test -- tests/unit/<archivo>` (el script ya trae `NODE_OPTIONS='--experimental-sqlite'`).

---

## Estructura de archivos

**Crear:**

| Archivo | Responsabilidad |
|---|---|
| `scripts/convert-orchid-photos.mjs` | Conversión única HEIC → webp |
| `public/products/phalaenopsis-*.webp` | Las 4 fotos (salida del script) |
| `data/orchid-care.ts` | Los 4 pasos de cuidado, bilingües |
| `components/orchids/OrchidsHero.tsx` | Bloque 1 |
| `components/orchids/OrchidsWhy.tsx` | Bloque 2 — comparación de duración |
| `components/orchids/OrchidsSizes.tsx` | Bloque 3 — las dos medidas, lee el producto |
| `components/orchids/OrchidsColors.tsx` | Bloque 4 — galería |
| `components/orchids/OrchidsCare.tsx` | Bloque 5 — los 4 pasos |
| `components/orchids/OrchidsCTA.tsx` | Bloque 6 — entrega y cierre |
| `app/[locale]/orchids/page.tsx` | Compone los seis |
| `tests/unit/orchid-catalog.test.ts` | Producto, limpieza, feed |
| `tests/unit/OrchidsSizes.test.tsx` | Render del bloque de medidas |
| `tests/unit/OrchidsCare.test.tsx` | Render del bloque de cuidado |

**Modificar:**

| Archivo | Cambio |
|---|---|
| `data/products.ts` | Producto nuevo; `active: false` en dos existentes |
| `lib/shop-categories.ts:9` | Imagen de la tarjeta `plants` |
| `lib/shop-categories.ts:38` | Sacar `cattleya-orchid` de `EXOTIC_SLUGS` |
| `messages/en.json`, `messages/es.json` | Namespace `orchids`; clave `nav.orchids` |
| `components/nav/NavLinks.tsx` | Enlace nuevo |
| `components/nav/MobileDrawer.tsx` | Enlace nuevo |
| `components/nav/Footer.tsx` | Enlace nuevo |
| `app/sitemap.ts` | `"orchids"` en `STATIC_PATHS` |

---

## Task 1: Convertir las cuatro fotos

**Files:**
- Create: `scripts/convert-orchid-photos.mjs`
- Create (salida): `public/products/phalaenopsis-{white-single,pink-single,pink-double,fuchsia-double}.webp`

Las fuentes están en `~/Downloads`. `sips` y `sharp` fallan o mal-rotan HEIC en esta máquina; `qlmanage` renderiza con la orientación EXIF ya aplicada y `cwebp` codifica. Este script es un calco de `scripts/convert-sympathy-photos.mjs`, sin la parte de recorte, que aquí no hace falta.

- [ ] **Step 1: Escribir el script**

```javascript
// scripts/convert-orchid-photos.mjs
// One-time converter: <input dir>/<IMG> -> public/products/phalaenopsis-<slug>.webp
// Mirrors scripts/convert-sympathy-photos.mjs: qlmanage renders with EXIF
// orientation baked in (sips/sharp mis-rotate or fail on HEIC here), then
// cwebp encodes at q80. No crops — all four frames are already tight.
// Usage: node scripts/convert-orchid-photos.mjs [inputDir]
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const INPUT_DIR = process.argv[2] || join(homedir(), "Downloads");
const OUT_DIR = join(process.cwd(), "public", "products");
const MAX_EDGE = 2000;
const QUALITY = 80;

const MANIFEST = [
  { src: "IMG_1957.HEIC", slug: "phalaenopsis-white-single" },
  { src: "IMG_1962.heic", slug: "phalaenopsis-pink-single" },
  { src: "IMG_1959.HEIC", slug: "phalaenopsis-pink-double" },
  { src: "IMG_1968.heic", slug: "phalaenopsis-fuchsia-double" },
];

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

function renderOriented(src, dir) {
  run("qlmanage", ["-t", "-s", String(MAX_EDGE), "-o", dir, src]);
  const png = readdirSync(dir).find((f) => f.endsWith(".png"));
  if (!png) throw new Error(`qlmanage produced no thumbnail for ${src}`);
  return join(dir, png);
}

async function convertOne({ src, slug }) {
  const inPath = join(INPUT_DIR, src);
  if (!existsSync(inPath)) return { slug, ok: false, reason: "source missing" };
  const outPath = join(OUT_DIR, `${slug}.webp`);
  const dir = mkdtempSync(join(tmpdir(), "orc_"));
  try {
    const png = renderOriented(inPath, dir);
    run("cwebp", ["-q", String(QUALITY), png, "-o", outPath]);
    const out = await sharp(outPath).metadata();
    return { slug, ok: true, dims: `${out.width}x${out.height}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

mkdirSync(OUT_DIR, { recursive: true });
for (const item of MANIFEST) {
  const r = await convertOne(item);
  console.log(r.ok ? `OK  ${r.slug}.webp  ${r.dims}` : `SKIP ${r.slug} (${r.reason})`);
}
```

- [ ] **Step 2: Correr el script**

```bash
node scripts/convert-orchid-photos.mjs
```

Esperado: cuatro líneas `OK`, ninguna `SKIP`. Las dimensiones deben ser verticales (alto > ancho), aproximadamente `1500x2000`.

Si sale `SKIP ... (source missing)`, los HEIC no están en `~/Downloads`; pásale la carpeta correcta como argumento.

- [ ] **Step 3: Verificar que los cuatro archivos existen y son webp**

```bash
file public/products/phalaenopsis-*.webp
```

Esperado: cuatro líneas, cada una diciendo `RIFF (little-endian) data, Web/P image`.

- [ ] **Step 4: Mirar las cuatro imágenes**

Ábrelas y confirma que el contenido corresponde al nombre: `white-single` es blanca de un tallo, `pink-single` rosa de un tallo, `pink-double` rosa de dos tallos, `fuchsia-double` fucsia de dos tallos. Si alguna no corresponde, corrige el `MANIFEST` y vuelve al paso 2 — el resto del plan depende de que estos nombres sean verdad.

- [ ] **Step 5: Commit**

```bash
git add scripts/convert-orchid-photos.mjs public/products/phalaenopsis-white-single.webp public/products/phalaenopsis-pink-single.webp public/products/phalaenopsis-pink-double.webp public/products/phalaenopsis-fuchsia-double.webp
git commit -m "feat(orchids): convert the four phalaenopsis photos to webp"
```

---

## Task 2: El producto `phalaenopsis-orchid`

**Files:**
- Create: `tests/unit/orchid-catalog.test.ts`
- Modify: `data/products.ts`

- [ ] **Step 1: Escribir el test que falla**

```typescript
// tests/unit/orchid-catalog.test.ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTS } from "@/data/products";

const orchid = () => PRODUCTS.find((p) => p.slug === "phalaenopsis-orchid");

describe("phalaenopsis-orchid", () => {
  it("exists, is active, and lives in the plants category", () => {
    const p = orchid();
    expect(p).toBeDefined();
    expect(p!.active).toBe(true);
    expect(p!.category).toBe("plants");
  });

  it("has exactly two variants at $65 and $85 pre-tax", () => {
    const p = orchid()!;
    expect(p.variants.map((v) => v.priceCents)).toEqual([6500, 8500]);
    expect(p.variants.map((v) => v.id)).toEqual(["single", "double"]);
  });

  it("is flagged for same-day delivery", () => {
    expect(orchid()!.tags).toContain("same-day");
  });

  it("carries the four real photos, white-single first", () => {
    const srcs = orchid()!.images.map((i) => i.src);
    expect(srcs).toEqual([
      "/products/phalaenopsis-white-single.webp",
      "/products/phalaenopsis-pink-single.webp",
      "/products/phalaenopsis-pink-double.webp",
      "/products/phalaenopsis-fuchsia-double.webp",
    ]);
  });

  it("every photo it references exists on disk", () => {
    for (const img of orchid()!.images) {
      expect(existsSync(join(process.cwd(), "public", img.src))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Correr el test para ver que falla**

```bash
npm test -- tests/unit/orchid-catalog.test.ts
```

Esperado: FAIL. El primer test falla con `expected undefined to be defined`.

- [ ] **Step 3: Agregar el producto**

En `data/products.ts`, inmediatamente después del objeto cuyo `slug` es `"opal-orchid"` (busca `slug: "opal-orchid"`), inserta este objeto nuevo en el array `PRODUCTS`:

```typescript
  {
    id: "p-pla-orc-01",
    slug: "phalaenopsis-orchid",
    title: { en: "Phalaenopsis Orchid", es: "Orquídea Phalaenopsis" },
    category: "plants",
    blurb: {
      en: "A living orchid that blooms for two to three months, not two to three days.",
      es: "Una orquídea viva que florece dos o tres meses, no dos o tres días.",
    },
    description: {
      en: "A phalaenopsis in a white ceramic pot, moss-topped, chosen from what's blooming best that morning. Cut flowers give you a week; this gives you eight to twelve weeks of bloom, and then it comes back next year if you let it. Choose one stem or two — the double is the one people notice from the doorway. Colors rotate with what's in: white, soft pink, fuchsia. Order before 2:00 pm for same-day delivery on Long Island. Care card included, and honestly the whole card comes down to: water once a week, never leave it sitting in a saucer.",
      es: "Una phalaenopsis en maceta de cerámica blanca, con musgo, elegida entre las que mejor están floreciendo esa mañana. Las flores cortadas te dan una semana; esta te da de ocho a doce semanas de floración, y vuelve el año siguiente si la dejas. Elige un tallo o dos — la doble es la que se nota desde la puerta. Los colores rotan según lo que haya: blanca, rosa suave, fucsia. Pide antes de las 2:00 pm para entrega el mismo día en Long Island. Incluye tarjeta de cuidado, y la tarjeta entera se resume en: riega una vez por semana y nunca la dejes parada en el plato.",
    },
    images: [
      {
        src: "/products/phalaenopsis-white-single.webp",
        alt: {
          en: "White phalaenopsis orchid, single stem, in a square white ceramic pot",
          es: "Orquídea phalaenopsis blanca de un tallo en maceta cuadrada de cerámica blanca",
        },
        aspect: "4/5",
      },
      {
        src: "/products/phalaenopsis-pink-single.webp",
        alt: {
          en: "Soft pink phalaenopsis orchid, single stem, in a fluted white pot",
          es: "Orquídea phalaenopsis rosa suave de un tallo en maceta blanca acanalada",
        },
        aspect: "4/5",
      },
      {
        src: "/products/phalaenopsis-pink-double.webp",
        alt: {
          en: "Soft pink phalaenopsis orchid with two stems in a square white ceramic pot",
          es: "Orquídea phalaenopsis rosa suave de dos tallos en maceta cuadrada de cerámica blanca",
        },
        aspect: "4/5",
      },
      {
        src: "/products/phalaenopsis-fuchsia-double.webp",
        alt: {
          en: "Fuchsia phalaenopsis orchid with two stems in a white cylinder pot",
          es: "Orquídea phalaenopsis fucsia de dos tallos en maceta cilíndrica blanca",
        },
        aspect: "4/5",
      },
    ],
    variants: [
      {
        id: "single",
        label: { en: "One stem", es: "Un tallo" },
        priceCents: 6500,
        subtitle: { en: "About 18–24 inches tall", es: "Unas 18–24 pulgadas de alto" },
      },
      {
        id: "double",
        label: { en: "Two stems", es: "Dos tallos" },
        priceCents: 8500,
        subtitle: { en: "Twice the blooms, same care", es: "El doble de flores, el mismo cuidado" },
      },
    ],
    tags: ["same-day", "new", "staff-pick"],
    occasions: ["just-because", "congrats", "birthday", "get-well"],
    colorFamily: ["white", "pink"],
    active: true,
    seo: {
      title: {
        en: "Phalaenopsis Orchid — Same-Day Delivery on Long Island | Diva Flowers",
        es: "Orquídea Phalaenopsis — Entrega el Mismo Día en Long Island | Diva Flowers",
      },
      description: {
        en: "A live phalaenopsis orchid in a white ceramic pot, $65 single stem or $85 double. Blooms for two to three months. Same-day delivery on Long Island.",
        es: "Orquídea phalaenopsis viva en maceta de cerámica blanca, $65 de un tallo u $85 de dos. Florece dos o tres meses. Entrega el mismo día en Long Island.",
      },
    },
  },
```

- [ ] **Step 4: Correr el test para ver que pasa**

```bash
npm test -- tests/unit/orchid-catalog.test.ts
```

Esperado: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/orchid-catalog.test.ts data/products.ts
git commit -m "feat(orchids): add the phalaenopsis product with single and double stem variants"
```

---

## Task 3: Retirar los dos productos mal etiquetados

`cattleya-orchid` y `opal-orchid` dicen ser orquídeas, tienen precios inventados ($75/$115/$155 y $115/$145/$185) y sus fotos son en realidad un arreglo tropical y uno mixto de rosas. Se desactivan, no se borran: `active: false` los saca de la tienda, del feed de Merchant (`buildMerchantFeed` filtra por `p.active`) y del sitemap (`isAvailableNow`), sin romper pedidos históricos que los referencien.

**Files:**
- Modify: `tests/unit/orchid-catalog.test.ts`
- Modify: `data/products.ts`
- Modify: `lib/shop-categories.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Agrega al final de `tests/unit/orchid-catalog.test.ts`, después del `describe` existente:

```typescript
import { buildMerchantFeed } from "@/lib/merchant-feed";
import { CATS, EXOTIC_SLUGS_FOR_TEST } from "@/lib/shop-categories";

describe("mislabeled orchid entries are retired", () => {
  for (const slug of ["cattleya-orchid", "opal-orchid"]) {
    it(`${slug} is inactive`, () => {
      const p = PRODUCTS.find((x) => x.slug === slug);
      expect(p, `${slug} should still exist in the catalog`).toBeDefined();
      expect(p!.active).toBe(false);
    });
  }

  it("neither appears in the Google Merchant feed", () => {
    const feed = buildMerchantFeed(PRODUCTS, "https://makythedivaflowers.com");
    expect(feed).not.toContain("cattleya-orchid");
    expect(feed).not.toContain("opal-orchid");
  });

  it("the real orchid does appear in the feed", () => {
    const feed = buildMerchantFeed(PRODUCTS, "https://makythedivaflowers.com");
    expect(feed).toContain("phalaenopsis-orchid");
  });

  it("cattleya-orchid is no longer listed as an exotic", () => {
    expect(EXOTIC_SLUGS_FOR_TEST.has("cattleya-orchid")).toBe(false);
  });

  it("the plants category tile uses a real orchid photo", () => {
    const plants = CATS.find((c) => c.slug === "plants")!;
    expect(plants.img).toBe("/products/phalaenopsis-white-single.webp");
    expect(existsSync(join(process.cwd(), "public", plants.img))).toBe(true);
  });
});
```

Mueve los dos `import` nuevos al bloque de imports en la cabecera del archivo — TypeScript no acepta `import` a media altura de un módulo.

- [ ] **Step 2: Correr los tests para ver que fallan**

```bash
npm test -- tests/unit/orchid-catalog.test.ts
```

Esperado: FAIL. El primero por `expected true to be false`; los de `EXOTIC_SLUGS_FOR_TEST` fallan al importar porque ese símbolo todavía no se exporta.

- [ ] **Step 3: Desactivar los dos productos**

En `data/products.ts`, en el objeto con `slug: "cattleya-orchid"`, cambia:

```typescript
    active: true,
```

por:

```typescript
    // Retired 2026-08-18: the copy claims a Cattleya orchid but the photo is a
    // tropical arrangement and the prices were never real. Superseded by
    // `phalaenopsis-orchid`. Kept inactive rather than deleted so historical
    // orders that reference this id still resolve.
    active: false,
```

Haz exactamente lo mismo en el objeto con `slug: "opal-orchid"`, con este comentario:

```typescript
    // Retired 2026-08-18: the copy claims a double-stem phalaenopsis but the
    // photo is a mixed rose arrangement and the prices were never real.
    // Superseded by `phalaenopsis-orchid`.
    active: false,
```

- [ ] **Step 4: Actualizar `lib/shop-categories.ts`**

Tres cambios en ese archivo.

En el array `CATS`, cambia la línea de `plants`:

```typescript
  { slug: "plants", img: "/products/opal-orchid.jpg" },
```

por:

```typescript
  { slug: "plants", img: "/products/phalaenopsis-white-single.webp" },
```

En `EXOTIC_SLUGS`, borra la línea `"cattleya-orchid",` (es la primera del `Set`).

Y expón el `Set` para el test — justo debajo de la declaración de `EXOTIC_SLUGS`, agrega:

```typescript
// Exposed for tests: asserts that retired products don't linger in this set.
export const EXOTIC_SLUGS_FOR_TEST: ReadonlySet<string> = EXOTIC_SLUGS;
```

- [ ] **Step 5: Correr los tests para ver que pasan**

```bash
npm test -- tests/unit/orchid-catalog.test.ts
```

Esperado: PASS, 11 tests.

- [ ] **Step 6: Correr los tests que tocan estos módulos**

```bash
npm test -- tests/unit/merchant-feed.test.ts tests/unit/product-helpers.test.ts tests/unit/ProductCard.test.tsx
```

Esperado: PASS los tres. Si alguno falla, es porque asumía que `cattleya-orchid` u `opal-orchid` estaban activos — arréglalo apuntando al producto nuevo.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/orchid-catalog.test.ts data/products.ts lib/shop-categories.ts
git commit -m "fix(catalog): retire the two mislabeled orchid entries"
```

---

## Task 4: Namespace `orchids` en los mensajes

`tests/unit/i18n-parity.test.ts` exige que `en.json` y `es.json` tengan exactamente las mismas rutas de clave, así que las dos ediciones van juntas.

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/es.json`

- [ ] **Step 1: Agregar el namespace a `messages/en.json`**

Inserta este bloque como hermano de `"corsages"` (al mismo nivel, dentro del objeto raíz):

```json
  "orchids": {
    "page_title": "Orchids — Diva Flowers",
    "meta_description": "Live phalaenopsis orchids in white ceramic, $65 single stem or $85 double. They bloom for two to three months. Same-day delivery on Long Island.",
    "hero_eyebrow": "Orchids",
    "hero_title": "Blooms for three months. Not three days.",
    "hero_sub": "Live phalaenopsis in white ceramic, from $65. Order before 2 pm and it arrives today.",
    "hero_cta": "See the two sizes",
    "why_eyebrow": "Why an orchid",
    "why_title": "The math nobody does at the counter.",
    "why_cut_label": "A $75 bouquet",
    "why_cut_value": "5–7 days",
    "why_orchid_label": "This orchid, $65",
    "why_orchid_value": "8–12 weeks",
    "why_body": "And when the last flower drops, the plant is still alive. Cut the spike above the second node and most of them spike again the following year. You are not buying a week of flowers — you are buying a plant that happens to be flowering.",
    "sizes_eyebrow": "Two sizes",
    "sizes_title": "One stem, or two.",
    "sizes_cta": "Order this one",
    "colors_eyebrow": "Colors",
    "colors_title": "White, soft pink, fuchsia.",
    "colors_body": "Color rotates with what is blooming best. Tell us a preference when you order and we will match it if we have it — if we don't, we will call you before we substitute.",
    "care_eyebrow": "Care",
    "care_title": "Four things. That's the whole list.",
    "cta_eyebrow": "Delivery",
    "cta_title": "Order before 2 pm, it arrives today.",
    "cta_body": "Same-day delivery across Long Island. Every orchid leaves the shop with a care card.",
    "cta_button": "Order an orchid",
    "cta_call": "Call the shop"
  },
```

- [ ] **Step 2: Agregar el mismo namespace a `messages/es.json`**

Mismas claves, en la misma posición:

```json
  "orchids": {
    "page_title": "Orquídeas — Diva Flowers",
    "meta_description": "Orquídeas phalaenopsis vivas en cerámica blanca, $65 de un tallo u $85 de dos. Florecen dos o tres meses. Entrega el mismo día en Long Island.",
    "hero_eyebrow": "Orquídeas",
    "hero_title": "Florece tres meses. No tres días.",
    "hero_sub": "Phalaenopsis vivas en cerámica blanca, desde $65. Pide antes de las 2 pm y llega hoy.",
    "hero_cta": "Ver las dos medidas",
    "why_eyebrow": "Por qué una orquídea",
    "why_title": "La cuenta que nadie hace en el mostrador.",
    "why_cut_label": "Un ramo de $75",
    "why_cut_value": "5–7 días",
    "why_orchid_label": "Esta orquídea, $65",
    "why_orchid_value": "8–12 semanas",
    "why_body": "Y cuando cae la última flor, la planta sigue viva. Corta la vara arriba del segundo nudo y la mayoría vuelve a sacar vara al año siguiente. No estás comprando una semana de flores — estás comprando una planta que además está florecida.",
    "sizes_eyebrow": "Dos medidas",
    "sizes_title": "Un tallo, o dos.",
    "sizes_cta": "Pedir esta",
    "colors_eyebrow": "Colores",
    "colors_title": "Blanca, rosa suave, fucsia.",
    "colors_body": "El color rota según lo que esté floreciendo mejor. Dinos tu preferencia al pedir y la buscamos — si no la tenemos, te llamamos antes de cambiarla.",
    "care_eyebrow": "Cuidado",
    "care_title": "Cuatro cosas. Esa es la lista completa.",
    "cta_eyebrow": "Entrega",
    "cta_title": "Pide antes de las 2 pm y llega hoy.",
    "cta_body": "Entrega el mismo día en todo Long Island. Cada orquídea sale con su tarjeta de cuidado.",
    "cta_button": "Pedir una orquídea",
    "cta_call": "Llamar a la tienda"
  },
```

- [ ] **Step 3: Agregar la clave del nav**

En `messages/en.json`, dentro de `"nav"`, después de `"sympathy": "Sympathy",`:

```json
    "orchids": "Orchids",
```

En `messages/es.json`, en el mismo lugar dentro de `"nav"`:

```json
    "orchids": "Orquídeas",
```

- [ ] **Step 4: Verificar la paridad**

```bash
npm test -- tests/unit/i18n-parity.test.ts tests/unit/i18n-keys.test.ts
```

Esperado: PASS. Si `i18n-parity` falla, te faltó una clave en uno de los dos archivos — el mensaje del test lista exactamente cuál.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json
git commit -m "feat(orchids): add the orchids i18n namespace"
```

---

## Task 5: Los datos de cuidado

**Files:**
- Create: `data/orchid-care.ts`
- Create: `tests/unit/OrchidsCare.test.tsx` (el test del componente llega en la Task 8; aquí solo el dato)

El texto de cuidado va en un módulo de datos, no en los mensajes, porque son cuatro registros con la misma forma — igual que `data/corsages-collection.ts`. Eso deja el componente sin lógica de contenido.

- [ ] **Step 1: Escribir el archivo de datos**

```typescript
// data/orchid-care.ts
import type { Localized } from "@/types/product";

export type OrchidCareStep = {
  id: "water" | "light" | "after-bloom" | "never";
  title: Localized;
  body: Localized;
};

export const ORCHID_CARE: readonly OrchidCareStep[] = [
  {
    id: "water",
    title: { en: "Water once a week", es: "Riega una vez por semana" },
    body: {
      en: "Three ice-cube-sized splashes of room-temperature water at the roots, or run it under the tap for fifteen seconds and let it drain all the way through. Once a week. That's it.",
      es: "Tres chorritos de agua a temperatura ambiente en las raíces, o pásala por el grifo quince segundos y deja que escurra por completo. Una vez por semana. Ya.",
    },
  },
  {
    id: "light",
    title: { en: "Bright, never direct", es: "Luz clara, nunca directa" },
    body: {
      en: "A few feet back from an east or north window is perfect. If the leaves go dark green it wants more light; if they go yellow-ish and leathery, it's getting too much.",
      es: "A un metro de una ventana al este o al norte está perfecto. Si las hojas se ponen verde oscuro quiere más luz; si se ponen amarillentas y correosas, le está dando de más.",
    },
  },
  {
    id: "after-bloom",
    title: { en: "When the flowers drop", es: "Cuando caen las flores" },
    body: {
      en: "The plant isn't dead — it's resting. Cut the spike about an inch above the second node from the bottom, keep watering, and most plants push a new spike within a few months.",
      es: "La planta no se murió — está descansando. Corta la vara unos dos centímetros arriba del segundo nudo desde abajo, sigue regando, y la mayoría saca vara nueva en pocos meses.",
    },
  },
  {
    id: "never",
    title: { en: "Never let it sit in water", es: "Nunca la dejes parada en agua" },
    body: {
      en: "This is the one that kills them. Standing water in the saucer or the cachepot rots the roots in about two weeks. Drain it every single time. And skip the ice cubes — cold shocks tropical roots.",
      es: "Esta es la que las mata. El agua estancada en el plato o en el cachepot pudre las raíces en unas dos semanas. Escúrrela siempre. Y olvida los cubos de hielo — el frío daña las raíces tropicales.",
    },
  },
];
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit -p tsconfig.json
```

Esperado: sin errores nuevos en `data/orchid-care.ts`. (El proyecto ya puede tener errores preexistentes en otros archivos; ignora los que no menciones tú.)

- [ ] **Step 3: Commit**

```bash
git add data/orchid-care.ts
git commit -m "feat(orchids): add the four care steps as data"
```

---

## Task 6: Hero y bloque del argumento

**Files:**
- Create: `components/orchids/OrchidsHero.tsx`
- Create: `components/orchids/OrchidsWhy.tsx`

Los dos son server components async sin estado. Usan `<img>` crudo, no `next/image`, por la misma razón documentada en `components/corsages/CorsagesHero.tsx`: los assets ya vienen pre-optimizados como WebP y así el hero no depende del optimizador `/_next/image`, que algunas extensiones bloquean.

- [ ] **Step 1: Escribir `OrchidsHero`**

```tsx
// components/orchids/OrchidsHero.tsx
// Raw <img> (not next/image) to match CorsagesHero: the asset is already
// pre-optimized WebP, and this keeps the hero visible when a privacy
// extension blocks the /_next/image optimizer.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function OrchidsHero({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  return (
    <header className="relative isolate overflow-hidden">
      <div className="relative h-[72vh] min-h-[500px] max-h-[820px]">
        <img
          src="/products/phalaenopsis-white-single.webp"
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
          loading="eager"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(14,13,12,0.78) 0%, rgba(14,13,12,0.25) 55%, transparent 100%)",
          }}
        />
      </div>

      <div className="absolute bottom-0 left-0 px-6 pb-10 sm:px-10 sm:pb-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-petal/80">
          {t("hero_eyebrow")}
        </p>
        <h1
          className="mt-3 max-w-2xl font-display text-5xl leading-[0.95] tracking-tighter text-bone sm:text-6xl md:text-7xl"
          style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 30, 'opsz' 144" }}
        >
          {t("hero_title")}
        </h1>
        <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-bone/70 sm:text-base">
          {t("hero_sub")}
        </p>
        <Link
          href={`/${locale}/product/phalaenopsis-orchid`}
          className="mt-6 inline-block rounded-full border border-bone/40 px-6 py-2.5 font-sans text-sm text-bone transition-colors hover:bg-bone hover:text-ink"
        >
          {t("hero_cta")}
        </Link>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Escribir `OrchidsWhy`**

```tsx
// components/orchids/OrchidsWhy.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";

export async function OrchidsWhy({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  return (
    <section className="bg-ink text-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          {t("why_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("why_title")}
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="border-t border-bone/15 pt-5">
            <p className="font-sans text-sm text-bone/60">{t("why_cut_label")}</p>
            <p className="mt-2 font-display text-5xl tracking-tighter text-bone/50">
              {t("why_cut_value")}
            </p>
          </div>
          <div className="border-t border-petal/60 pt-5">
            <p className="font-sans text-sm text-petal">{t("why_orchid_label")}</p>
            <p className="mt-2 font-display text-5xl tracking-tighter">
              {t("why_orchid_value")}
            </p>
          </div>
        </div>

        <p className="mt-10 max-w-2xl font-sans text-sm leading-relaxed text-bone/70 md:text-base">
          {t("why_body")}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Verificar que compilan**

```bash
npx tsc --noEmit -p tsconfig.json
```

Esperado: sin errores en los dos archivos nuevos.

- [ ] **Step 4: Commit**

```bash
git add components/orchids/OrchidsHero.tsx components/orchids/OrchidsWhy.tsx
git commit -m "feat(orchids): add the hero and the duration-comparison block"
```

---

## Task 7: Bloque de las dos medidas

Este es el único componente que lee el catálogo, para que los precios existan en un solo lugar. Va con test porque tiene lógica: si el producto cambia de variantes, este bloque debe reflejarlo o fallar ruidosamente.

**Files:**
- Create: `tests/unit/OrchidsSizes.test.tsx`
- Create: `components/orchids/OrchidsSizes.tsx`

- [ ] **Step 1: Escribir el test que falla**

El stub de `next-intl/server` es el mismo patrón de `tests/unit/PromPieces.test.tsx`: `getTranslations` necesita contexto RSC que jsdom no da, así que se reemplaza por una búsqueda síncrona contra los mensajes reales.

```tsx
// tests/unit/OrchidsSizes.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

declare global {
  // eslint-disable-next-line no-var
  var __ORCHIDS_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const enMessages = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const esMessages = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => {
      return (key: string) => {
        const locale = globalThis.__ORCHIDS_LOCALE__ ?? "en";
        const dict = locale === "es" ? esMessages : enMessages;
        return `${namespace}.${key}`
          .split(".")
          .reduce<unknown>(
            (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
            dict,
          ) as string;
      };
    },
  };
});

const { OrchidsSizes } = await import("@/components/orchids/OrchidsSizes");

async function renderSizes(locale: "en" | "es" = "en") {
  globalThis.__ORCHIDS_LOCALE__ = locale;
  const ui = await OrchidsSizes({ locale });
  return render(ui);
}

describe("OrchidsSizes", () => {
  afterEach(() => {
    delete (globalThis as any).__ORCHIDS_LOCALE__;
  });

  it("shows both prices, formatted without cents", async () => {
    await renderSizes("en");
    expect(screen.getByText("$65")).toBeInTheDocument();
    expect(screen.getByText("$85")).toBeInTheDocument();
  });

  it("labels each size in the active locale", async () => {
    await renderSizes("es");
    expect(screen.getByText("Un tallo")).toBeInTheDocument();
    expect(screen.getByText("Dos tallos")).toBeInTheDocument();
  });

  it("links each size to the product page with the variant preselected", async () => {
    await renderSizes("en");
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/en/product/phalaenopsis-orchid?variant=single");
    expect(hrefs).toContain("/en/product/phalaenopsis-orchid?variant=double");
  });

  it("shows one photo per size", async () => {
    const { container } = await renderSizes("en");
    const srcs = [...container.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    expect(srcs).toEqual([
      "/products/phalaenopsis-white-single.webp",
      "/products/phalaenopsis-pink-double.webp",
    ]);
  });
});
```

- [ ] **Step 2: Correr el test para ver que falla**

```bash
npm test -- tests/unit/OrchidsSizes.test.tsx
```

Esperado: FAIL al resolver `@/components/orchids/OrchidsSizes` — el módulo no existe.

- [ ] **Step 3: Escribir el componente**

`formatMoneyCents` ya omite los centavos cuando el monto es redondo, así que `6500` sale como `$65`.

```tsx
// components/orchids/OrchidsSizes.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";
import { formatMoneyCents } from "@/lib/format";

const SLUG = "phalaenopsis-orchid";

// One photo per size, so the card shows what you actually get.
const PHOTO_BY_VARIANT: Record<string, string> = {
  single: "/products/phalaenopsis-white-single.webp",
  double: "/products/phalaenopsis-pink-double.webp",
};

export async function OrchidsSizes({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  const product = PRODUCTS.find((p) => p.slug === SLUG);
  if (!product) return null;

  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("sizes_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-6xl tracking-tighter leading-[0.95]">
          {t("sizes_title")}
        </h2>

        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {product.variants.map((v) => (
            <li
              key={v.id}
              className="overflow-hidden rounded-[var(--radius-bento)] bg-petal"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={PHOTO_BY_VARIANT[v.id] ?? product.images[0].src}
                  alt={product.images[0].alt[locale]}
                  className="absolute inset-0 size-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display italic text-2xl leading-tight">
                    {v.label[locale]}
                  </h3>
                  <span className="whitespace-nowrap font-mono text-base font-semibold">
                    {formatMoneyCents(v.priceCents, locale)}
                  </span>
                </div>
                {v.subtitle ? (
                  <p className="font-sans text-sm leading-relaxed text-ink/80">
                    {v.subtitle[locale]}
                  </p>
                ) : null}
                <Link
                  href={`/${locale}/product/${SLUG}?variant=${v.id}`}
                  className="mt-1 self-start rounded-full border border-ink/25 px-5 py-2 font-sans text-sm transition-colors hover:bg-ink hover:text-bone"
                >
                  {t("sizes_cta")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Correr el test para ver que pasa**

```bash
npm test -- tests/unit/OrchidsSizes.test.tsx
```

Esperado: PASS, 4 tests.

Si el test del `href` falla, comprueba cómo lee la variante la página de producto: abre `app/[locale]/product/[slug]/page.tsx` y `components/product/PdpConfigurator.tsx` y confirma el nombre del parámetro. Si no es `variant`, ajusta test y componente al nombre real; si la PDP no acepta ninguno, quita el `?variant=` de ambos y deja el enlace limpio.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/OrchidsSizes.test.tsx components/orchids/OrchidsSizes.tsx
git commit -m "feat(orchids): add the two-sizes block driven by the product variants"
```

---

## Task 8: Colores y cuidado

**Files:**
- Create: `components/orchids/OrchidsColors.tsx`
- Create: `tests/unit/OrchidsCare.test.tsx`
- Create: `components/orchids/OrchidsCare.tsx`

- [ ] **Step 1: Escribir `OrchidsColors`**

```tsx
// components/orchids/OrchidsColors.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { PRODUCTS } from "@/data/products";

export async function OrchidsColors({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  const product = PRODUCTS.find((p) => p.slug === "phalaenopsis-orchid");
  if (!product) return null;

  return (
    <section className="bg-petal/30 text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("colors_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("colors_title")}
        </h2>

        <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {product.images.map((img) => (
            <li
              key={img.src}
              className="relative aspect-[4/5] overflow-hidden rounded-[var(--radius-bento)] bg-bone"
            >
              <img
                src={img.src}
                alt={img.alt[locale]}
                className="absolute inset-0 size-full object-cover"
                loading="lazy"
              />
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-2xl font-sans text-sm leading-relaxed text-ink/75">
          {t("colors_body")}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Escribir el test que falla para `OrchidsCare`**

```tsx
// tests/unit/OrchidsCare.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ORCHID_CARE } from "@/data/orchid-care";

declare global {
  // eslint-disable-next-line no-var
  var __ORCHIDS_CARE_LOCALE__: "en" | "es" | undefined;
}

vi.mock("next-intl/server", async () => {
  const enMessages = (await import("@/messages/en.json")).default as Record<string, unknown>;
  const esMessages = (await import("@/messages/es.json")).default as Record<string, unknown>;
  return {
    getTranslations: async (namespace: string) => {
      return (key: string) => {
        const locale = globalThis.__ORCHIDS_CARE_LOCALE__ ?? "en";
        const dict = locale === "es" ? esMessages : enMessages;
        return `${namespace}.${key}`
          .split(".")
          .reduce<unknown>(
            (acc, k) => (acc as Record<string, unknown> | undefined)?.[k],
            dict,
          ) as string;
      };
    },
  };
});

const { OrchidsCare } = await import("@/components/orchids/OrchidsCare");

async function renderCare(locale: "en" | "es" = "en") {
  globalThis.__ORCHIDS_CARE_LOCALE__ = locale;
  const ui = await OrchidsCare({ locale });
  return render(ui);
}

describe("OrchidsCare", () => {
  afterEach(() => {
    delete (globalThis as any).__ORCHIDS_CARE_LOCALE__;
  });

  it("renders every care step", async () => {
    await renderCare("en");
    for (const step of ORCHID_CARE) {
      expect(screen.getByText(step.title.en)).toBeInTheDocument();
    }
  });

  it("renders the Spanish copy under the es locale", async () => {
    await renderCare("es");
    for (const step of ORCHID_CARE) {
      expect(screen.getByText(step.title.es)).toBeInTheDocument();
    }
  });

  it("numbers the steps in order", async () => {
    await renderCare("en");
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("04")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Correr el test para ver que falla**

```bash
npm test -- tests/unit/OrchidsCare.test.tsx
```

Esperado: FAIL al resolver `@/components/orchids/OrchidsCare`.

- [ ] **Step 4: Escribir `OrchidsCare`**

Sigue la forma numerada de `components/corsages/CorsagesHowItWorks.tsx`.

```tsx
// components/orchids/OrchidsCare.tsx
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { ORCHID_CARE } from "@/data/orchid-care";

export async function OrchidsCare({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  return (
    <section className="bg-ink text-bone">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/40">
          {t("care_eyebrow")}
        </p>
        <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("care_title")}
        </h2>
        <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
          {ORCHID_CARE.map((step, i) => (
            <li key={step.id} className="border-t border-bone/15 pt-5">
              <span className="font-mono text-[11px] tracking-[0.2em] text-bone/40">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-xl leading-snug">
                {step.title[locale]}
              </h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-bone/70">
                {step.body[locale]}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Correr el test para ver que pasa**

```bash
npm test -- tests/unit/OrchidsCare.test.tsx
```

Esperado: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add components/orchids/OrchidsColors.tsx components/orchids/OrchidsCare.tsx tests/unit/OrchidsCare.test.tsx
git commit -m "feat(orchids): add the color gallery and the care block"
```

---

## Task 9: Cierre y página

**Files:**
- Create: `components/orchids/OrchidsCTA.tsx`
- Create: `app/[locale]/orchids/page.tsx`

- [ ] **Step 1: Escribir `OrchidsCTA`**

`SITE.phoneHref` ya existe en `data/site.ts` y es el que usa el footer.

```tsx
// components/orchids/OrchidsCTA.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { SITE } from "@/data/site";

export async function OrchidsCTA({ locale }: { locale: Locale }) {
  const t = await getTranslations("orchids");
  return (
    <section className="bg-bone text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
          {t("cta_eyebrow")}
        </p>
        <h2 className="mt-3 max-w-2xl font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
          {t("cta_title")}
        </h2>
        <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed text-ink/75">
          {t("cta_body")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/product/phalaenopsis-orchid`}
            className="rounded-full bg-ink px-6 py-3 font-sans text-sm text-bone transition-opacity hover:opacity-85"
          >
            {t("cta_button")}
          </Link>
          <a
            href={SITE.phoneHref}
            className="rounded-full border border-ink/25 px-6 py-3 font-sans text-sm transition-colors hover:bg-ink hover:text-bone"
          >
            {t("cta_call")}
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Leer la guía de routing antes de escribir la página**

Este repo corre una versión de Next con breaking changes respecto a lo que sabes — lo dice `AGENTS.md`. Antes del paso 3, lee la guía de App Router y de metadata en `node_modules/next/dist/docs/` y confirma la firma actual de `generateMetadata` y de las props de página. La plantilla de abajo copia lo que hoy hace `app/[locale]/corsages-boutonnieres/page.tsx`, que funciona; si la guía dice otra cosa, gana la guía.

- [ ] **Step 3: Escribir la página**

```tsx
// app/[locale]/orchids/page.tsx
import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { Grain } from "@/components/brand/Grain";
import { OrchidsHero } from "@/components/orchids/OrchidsHero";
import { OrchidsWhy } from "@/components/orchids/OrchidsWhy";
import { OrchidsSizes } from "@/components/orchids/OrchidsSizes";
import { OrchidsColors } from "@/components/orchids/OrchidsColors";
import { OrchidsCare } from "@/components/orchids/OrchidsCare";
import { OrchidsCTA } from "@/components/orchids/OrchidsCTA";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "orchids" });
  return {
    title: t("page_title"),
    description: t("meta_description"),
    alternates: {
      canonical: `/${locale}/orchids`,
      languages: {
        en: "/en/orchids",
        es: "/es/orchids",
      },
    },
  };
}

export default async function OrchidsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: locale === "es" ? "Inicio" : "Home", href: `/${locale}` },
          {
            name: locale === "es" ? "Orquídeas" : "Orchids",
            href: `/${locale}/orchids`,
          },
        ]}
      />
      <Grain />
      <OrchidsHero locale={locale} />
      <OrchidsWhy locale={locale} />
      <OrchidsSizes locale={locale} />
      <OrchidsColors locale={locale} />
      <OrchidsCare locale={locale} />
      <OrchidsCTA locale={locale} />
    </main>
  );
}
```

- [ ] **Step 4: Levantar el dev server y mirar la página**

Usa la herramienta de preview del entorno, no `npm run dev` por bash. Si no existe `.claude/launch.json`, créalo:

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "diva-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

Abre `http://localhost:3000/en/orchids` y luego `http://localhost:3000/es/orchids`.

Verifica, con la consola del navegador abierta:
- Los seis bloques aparecen en orden y no hay errores en consola
- Las seis imágenes cargan (hero, dos de medidas, cuatro de galería — la del hero se repite)
- Los precios dicen `$65` y `$85`, sin centavos
- En `/es/` todo el texto está en español, incluidas las etiquetas de variante
- Ningún bloque desborda horizontalmente a 375px de ancho

- [ ] **Step 5: Commit**

```bash
git add components/orchids/OrchidsCTA.tsx "app/[locale]/orchids/page.tsx"
git commit -m "feat(orchids): add the closing CTA and the /orchids page"
```

---

## Task 10: Navegación, footer y sitemap

**Files:**
- Modify: `components/nav/NavLinks.tsx`
- Modify: `components/nav/MobileDrawer.tsx`
- Modify: `components/nav/Footer.tsx`
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Nav de escritorio**

En `components/nav/NavLinks.tsx`, en el array `links`, agrega como primer elemento (antes de `sympathy`):

```typescript
    { href: `/${locale}/orchids`, label: t("orchids") },
```

- [ ] **Step 2: Drawer móvil**

En `components/nav/MobileDrawer.tsx`, en el array de enlaces (alrededor de la línea 12), agrega antes de la entrada de `sympathy`:

```typescript
  { href: `/${locale}/orchids`, key: "orchids" },
```

- [ ] **Step 3: Footer**

En `components/nav/Footer.tsx`, en la fila de enlaces (alrededor de la línea 93), agrega antes del enlace a `journal`:

```tsx
            <Link href={`/${locale}/orchids`} className="hover:text-bone transition-colors">{tNav("orchids")}</Link>
```

- [ ] **Step 4: Sitemap**

En `app/sitemap.ts`, en `STATIC_PATHS`, agrega `"orchids",` después de `"shop/sympathy",`.

- [ ] **Step 5: Verificar en el navegador**

Recarga `http://localhost:3000/en` y comprueba:
- "Orchids" aparece en el nav de escritorio y lleva a `/en/orchids`
- A 375px de ancho, "Orchids" aparece en el drawer móvil
- El enlace del footer funciona
- `http://localhost:3000/sitemap.xml` contiene `/en/orchids` y `/es/orchids`

- [ ] **Step 6: Commit**

```bash
git add components/nav/NavLinks.tsx components/nav/MobileDrawer.tsx components/nav/Footer.tsx app/sitemap.ts
git commit -m "feat(orchids): link /orchids from the nav, footer, and sitemap"
```

---

## Task 11: Verificación final

- [ ] **Step 1: Correr los tests de esta rama**

```bash
npm test -- tests/unit/orchid-catalog.test.ts tests/unit/OrchidsSizes.test.tsx tests/unit/OrchidsCare.test.tsx tests/unit/i18n-parity.test.ts tests/unit/i18n-keys.test.ts tests/unit/merchant-feed.test.ts
```

Esperado: todo PASS.

- [ ] **Step 2: Correr la suite completa y comparar contra la base**

```bash
npm test 2>&1 | tail -30
```

Hay ~7 fallos preexistentes (spawn de Chromium, checkout/preview) que también fallan en `main`. Si ves fallos distintos a esos, son tuyos.

Para comparar sin ambigüedad:

```bash
git stash && npm test 2>&1 | tail -30 && git stash pop
```

- [ ] **Step 3: Build de producción**

```bash
npm run build
```

Esperado: build exitoso, y `/[locale]/orchids` listado en la salida de rutas.

- [ ] **Step 4: Comprobar el feed de Merchant en el build**

```bash
npm run build && npx next start &
sleep 8
curl -s localhost:3000/merchant-feed.xml | grep -c "phalaenopsis-orchid"
curl -s localhost:3000/merchant-feed.xml | grep -c "cattleya-orchid\|opal-orchid"
```

Esperado: la primera cuenta ≥ 1; la segunda exactamente `0`. Detén el servidor cuando termines.

- [ ] **Step 5: Revisar la tienda**

Abre `http://localhost:3000/en/shop/plants` y confirma:
- La orquídea nueva aparece, con foto real y precio desde $65
- `cattleya-orchid` y `opal-orchid` ya no aparecen
- En `http://localhost:3000/en/shop`, la tarjeta de "Plants & Orchids" muestra la orquídea blanca, no el arreglo de rosas

- [ ] **Step 6: Push de la rama**

```bash
git push -u origin feat/orchids-section
```

**No mergear a `main` sin decírselo al dueño.** Y al desplegar: purgar el CDN de Hostinger, o la versión vieja de las páginas se queda servida.

---

## Fuera de alcance

Anotado en el spec, repetido aquí para que nadie lo agregue de más:

- Bloque de cuentas comerciales o corporativas
- Enlace cruzado desde `/sympathy`
- Destacado en el bento del home
- Categoría propia "Orquídeas" separada de `plants`
- Color como opción de compra

## Deuda observada, no tocada

`app/sitemap.ts` lista `shop/sympathy` pero no las landings `/sympathy`, `/corsages-boutonnieres` ni `/mothers-day`. Es anterior a este trabajo. Aquí solo se agrega `orchids`.
