"use client";
import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { PencilSimple, Check, X, ArrowCounterClockwise, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Product } from "@/types/product";
import type { PriceOverride } from "@/lib/product-prices";

type Props = {
  products: Product[];
  initialOverrides: PriceOverride[];
};

type EditState = { productId: string; variantId: string; raw: string } | null;
type SaveStatus = "idle" | "saving" | "saved" | "error";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProductPricesPage({ products, initialOverrides }: Props) {
  const t = useTranslations("admin_products");
  const locale = useLocale() as "en" | "es";
  const [overrides, setOverrides] = useState<Map<string, number>>(
    () => new Map(initialOverrides.map((o) => [`${o.productId}::${o.variantId}`, o.priceCents])),
  );
  const [editing, setEditing] = useState<EditState>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.en.toLowerCase().includes(q) ||
        p.title.es.toLowerCase().includes(q) ||
        p.variants.some((v) => v.label.en.toLowerCase().includes(q) || v.label.es.toLowerCase().includes(q)),
    );
  }, [products, search]);

  function startEdit(productId: string, variantId: string, currentCents: number) {
    setEditing({ productId, variantId, raw: (currentCents / 100).toFixed(2) });
  }

  async function saveEdit() {
    if (!editing) return;
    const cents = Math.round(parseFloat(editing.raw) * 100);
    if (isNaN(cents) || cents < 0) return;
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/product-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: editing.productId, variantId: editing.variantId, priceCents: cents }),
      });
      if (!res.ok) throw new Error();
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(`${editing.productId}::${editing.variantId}`, cents);
        return next;
      });
      setStatus("saved");
      setEditing(null);
      setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  async function resetVariant(productId: string, variantId: string) {
    setStatus("saving");
    try {
      const res = await fetch("/api/admin/product-prices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId }),
      });
      if (!res.ok) throw new Error();
      setOverrides((prev) => {
        const next = new Map(prev);
        next.delete(`${productId}::${variantId}`);
        return next;
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  }

  const isEditing = (pid: string, vid: string) =>
    editing?.productId === pid && editing?.variantId === vid;

  return (
    <main className="max-w-[860px] mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <Link href={`/${locale}/admin/settings`} className="text-mute-500 hover:text-ink text-sm">
          {t("back")}
        </Link>
        {status === "saved" && (
          <span className="text-sm text-green-700 flex items-center gap-1">
            <Check size={14} weight="bold" /> {t("saved")}
          </span>
        )}
        {status === "error" && (
          <span className="text-sm text-rouge">{t("error")}</span>
        )}
      </div>

      <h1 className="font-display text-3xl text-ink mb-1">{t("title")}</h1>
      <p className="text-sm text-mute-500 mb-6">{t("subtitle")}</p>

      {/* Search */}
      <div className="relative mb-4">
        <MagnifyingGlass size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search_placeholder")}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white text-sm"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((product) => (
          <div key={product.id} className="bg-white rounded-bento shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-mute-100 flex items-center gap-3">
              {product.images[0] && (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={product.images[0].src}
                    alt={product.images[0].alt[locale]}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-display text-sm text-ink truncate">{product.title[locale]}</span>
                <span className="text-xs text-mute-400 capitalize flex-shrink-0">{product.category}</span>
              </div>
            </div>

            <table className="w-full text-sm">
              <tbody>
                {product.variants.map((variant) => {
                  const key = `${product.id}::${variant.id}`;
                  const overrideCents = overrides.get(key);
                  const hasOverride = overrideCents !== undefined;
                  const activeCents = overrideCents ?? variant.priceCents;

                  return (
                    <tr key={variant.id} className="border-t border-mute-50 first:border-0">
                      <td className="px-5 py-3 text-mute-700">
                        {variant.label[locale]}
                        {variant.subtitle && (
                          <span className="ml-1.5 text-xs text-mute-400">{variant.subtitle[locale]}</span>
                        )}
                      </td>

                      {/* Base price */}
                      <td className="px-3 py-3 text-right tabular-nums text-mute-400 text-xs whitespace-nowrap">
                        {hasOverride ? (
                          <span>{t("base_label")}: {money(variant.priceCents)}</span>
                        ) : null}
                      </td>

                      {/* Active price / edit */}
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {isEditing(product.id, variant.id) ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-mute-500 text-sm">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editing!.raw}
                              onChange={(e) => setEditing({ ...editing!, raw: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                              autoFocus
                              className="w-24 px-2 py-1 rounded-lg border border-ink bg-white text-right tabular-nums outline-none text-sm"
                            />
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={status === "saving"}
                              className="p-1.5 rounded-lg bg-rouge text-bone hover:bg-rouge/90 disabled:opacity-40"
                              aria-label={t("save")}
                            >
                              <Check size={13} weight="bold" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              className="p-1.5 rounded-lg border border-mute-200 text-mute-600 hover:bg-mute-100"
                              aria-label={t("cancel")}
                            >
                              <X size={13} weight="bold" />
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className={`tabular-nums font-medium ${hasOverride ? "text-rouge" : "text-ink"}`}>
                              {money(activeCents)}
                            </span>
                            <button
                              type="button"
                              onClick={() => startEdit(product.id, variant.id, activeCents)}
                              className="p-1.5 rounded-lg text-mute-400 hover:text-ink hover:bg-mute-100 transition"
                              aria-label={t("edit_label")}
                            >
                              <PencilSimple size={13} weight="bold" />
                            </button>
                            {hasOverride && (
                              <button
                                type="button"
                                onClick={() => resetVariant(product.id, variant.id)}
                                className="p-1.5 rounded-lg text-mute-400 hover:text-rouge hover:bg-rouge/5 transition"
                                aria-label={t("reset")}
                                title={t("reset")}
                              >
                                <ArrowCounterClockwise size={13} weight="bold" />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </main>
  );
}
