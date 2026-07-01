"use client";
import { useState } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import type { Product } from "@/types/product";
import type { CartLine, CustomCartLine } from "@/types/order";

type Props = {
  products: Product[];
  onAdd: (line: CartLine) => void;
};

export default function ProductPicker({ products, onAdd }: Props) {
  const t = useTranslations("admin_intake");
  const locale = useLocale() as "en" | "es";
  const [query, setQuery] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState<Omit<CustomCartLine, "kind" | "qty">>({
    title: "",
    priceCents: 0,
    designerNotes: "",
  });

  const filtered = products.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return p.title.en.toLowerCase().includes(q) || p.title.es.toLowerCase().includes(q);
  });

  function addCustom() {
    if (!custom.title.trim() || custom.priceCents <= 0) return;
    onAdd({
      kind: "custom",
      title: custom.title,
      priceCents: custom.priceCents,
      designerNotes: custom.designerNotes || undefined,
      qty: 1,
    });
    setCustom({ title: "", priceCents: 0, designerNotes: "" });
    setShowCustom(false);
  }

  return (
    <div className="mb-4">
      <label className="block text-[11px] uppercase tracking-widest text-mute-400 mb-2">{t("products_label")}</label>
      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("products_search_placeholder")}
          className="flex-1 p-3.5 rounded-xl bg-white border border-mute-200 outline-none focus:border-ink"
        />
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className="px-4 py-3.5 rounded-xl border border-dashed border-mute-300 text-mute-600 hover:border-rouge hover:text-rouge transition whitespace-nowrap"
        >
          {t("products_add_custom")}
        </button>
      </div>

      {showCustom && (
        <div className="grid gap-2 p-3 mb-3 rounded-xl bg-white border border-mute-200">
          <input
            value={custom.title}
            onChange={(e) => setCustom({ ...custom, title: e.target.value })}
            placeholder={t("products_custom_title_placeholder")}
            className="p-3 rounded-lg bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              step={0.01}
              value={custom.priceCents > 0 ? (custom.priceCents / 100).toString() : ""}
              onChange={(e) => setCustom({ ...custom, priceCents: Math.round(parseFloat(e.target.value || "0") * 100) })}
              placeholder={t("products_custom_price_placeholder")}
              className="p-3 rounded-lg bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
            />
            <button type="button" onClick={addCustom} className="rounded-lg bg-ink text-bone py-3">
              {t("products_custom_add")}
            </button>
          </div>
          <input
            value={custom.designerNotes ?? ""}
            onChange={(e) => setCustom({ ...custom, designerNotes: e.target.value })}
            placeholder={t("products_custom_notes_placeholder")}
            className="p-3 rounded-lg bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5 mb-4 max-h-[400px] overflow-y-auto pr-1">
        {filtered.map((p) => {
          const variant = p.variants[0];
          const img = p.images[0];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onAdd({ kind: "catalog", productId: p.id, variantId: variant.id, addOnIds: [], qty: 1 })
              }
              className="text-left bg-white border border-mute-100 hover:border-mute-300 rounded-2xl p-1.5 transition"
            >
              <div className="aspect-[4/5] rounded-xl bg-mute-100 overflow-hidden relative">
                {img && (
                  <Image
                    src={img.src}
                    alt={img.alt[locale]}
                    fill
                    sizes="(max-width: 1180px) 18vw, 220px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="px-1 pt-1.5 pb-1.5">
                <div className="font-display text-sm leading-tight">{p.title[locale]}</div>
                <div className="text-xs text-mute-500 tabular-nums">${(variant.priceCents / 100).toFixed(0)}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
