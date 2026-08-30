import { PRODUCTS } from "@/data/products";
import { productMetaTitle, productMetaDescription } from "@/lib/seo/product-meta";
import { productDetailBlocks, productRichDescription } from "@/lib/seo/product-detail";
import { namesFlower, headlineFlowers } from "@/lib/seo/flowers";

const A = PRODUCTS.filter(p => p.active && !p.giftExtra);
const LOC = ["en","es"] as const;
const fail: Record<string,string[]> = {};
const add = (k:string,v:string) => (fail[k] ??= []).push(v);

const NOTICE = /\b(24|48|72)\s*(hours|horas)\b|hours? ahead|reserva\s+con|reserve at least|por encargo|made to order/i;

for (const p of A) {
  for (const l of LOC) {
    const t = productMetaTitle(p,l);
    const d = productMetaDescription(p,l);
    const rich = productRichDescription(p,l);
    const del = productDetailBlocks(p,l).find(b=>b.key==="delivery")!.body;

    if (t.length > 90) add("título >90 chars", `${p.slug} (${l}) ${t.length}`);
    if ((t.match(/Diva Flowers/g)||[]).length !== 1) add("marca no aparece exactamente 1 vez", `${p.slug} (${l})`);
    if (!t.includes("Albertson, NY")) add("título sin pueblo", `${p.slug} (${l})`);
    if (/(\b\w+\b)[\s—|·-]+\1\b/i.test(t)) add("palabra repetida en título", `${p.slug} (${l}) ${t}`);
    if ((t.match(/&/g)||[]).length > 1) add("dos o más '&' en título", `${p.slug} (${l}) ${t}`);
    if ((t.match(/ y /g)||[]).length > 1) add("dos o más ' y ' en título", `${p.slug} (${l}) ${t}`);
    if (/—[^—]*—[^—]*—/.test(t)) add("tres guiones largos", `${p.slug} (${l})`);

    if (rich.split(/\s+/).length < 150) add("copy <150 palabras", `${p.slug} (${l})`);
    if (d.length > 320) add("meta desc >320 chars", `${p.slug} (${l}) ${d.length}`);

    const today = /goes out today|sale hoy mismo/.test(del);
    if (today !== p.tags.includes("same-day")) add("entrega no coincide con tag", `${p.slug} (${l})`);
    if (today && NOTICE.test(`${p.description[l]} ${p.blurb[l]}`)) add("promete hoy pero la copia pide antelación", `${p.slug} (${l})`);
    if (/\.\s*\./.test(d) || /\s{2,}/.test(d)) add("puntuación/espacios rotos en meta", `${p.slug} (${l})`);
  }
  // Cross-locale
  if (productMetaTitle(p,"en") === productMetaTitle(p,"es")) add("título idéntico en ambos idiomas", p.slug);
  const blocksEn = productDetailBlocks(p,"en").map(b=>b.body).join(" ");
  const blocksEs = productDetailBlocks(p,"es").map(b=>b.body).join(" ");
  if (blocksEn === blocksEs) add("bloques sin traducir", p.slug);
  // Does the title say what the product IS?
  const KEY = /rose|orchid|tulip|peon|lisianthus|anemone|ranunculus|dahlia|lil(y|ies)|hydrangea|sunflower|carnation|gerbera|anthurium|allium|craspedia|fern|bouquet|arrangement|basket|vase|plant|subscription|rosa|orquídea|tulipán|lirio|hortensia|girasol|clavel|dalia|ramo|arreglo|cesta|jarrón|planta|helecho|suscripción/i;
  for (const l of LOC) if (!KEY.test(productMetaTitle(p,l))) add("título sin flor NI categoría", `${p.slug} (${l})`);
  // Title lacks any flower though the copy names one
  for (const l of LOC) {
    if (headlineFlowers(`${p.description.en} ${p.blurb.en}`).length && !namesFlower(productMetaTitle(p,l), l))
      add("título sin flor (la copia sí la nombra)", `${p.slug} (${l})`);
  }
}
const dupEn = new Set(A.map(p=>productMetaTitle(p,"en")));
if (dupEn.size !== A.length) add("títulos EN duplicados", `${A.length - dupEn.size}`);

console.log(`AUDITORÍA: ${A.length} productos × 2 idiomas\n`);
const keys = Object.keys(fail).sort((a,b)=>fail[b].length-fail[a].length);
if (!keys.length) console.log("  sin incidencias");
for (const k of keys) {
  console.log(`  [${fail[k].length}] ${k}`);
  for (const v of fail[k].slice(0,4)) console.log(`        ${v}`);
  if (fail[k].length>4) console.log(`        …y ${fail[k].length-4} más`);
}
