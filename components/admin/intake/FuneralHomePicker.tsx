"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react/dist/ssr";
import { sameAddress } from "@/lib/address-key";
import type { Address } from "@/types/address";
import type { FuneralAddress, FuneralHome } from "@/lib/funeral-homes";

type Snapshot = { homes: FuneralHome[]; recent: FuneralAddress[] };

type Props = {
  /** The order's delivery address (empty street when none yet). */
  address: Address;
  /** Fill the delivery address — the parent also switches the order to delivery. */
  onPick: (address: Address) => void;
};

/**
 * Funeral orders mostly go to the same few funeral homes. Lists the saved ones,
 * the addresses of past funeral orders not saved yet, and lets staff name the
 * address on this order so it is one tap next time.
 */
export default function FuneralHomePicker({ address, onPick }: Props) {
  const t = useTranslations("admin_intake");
  const [data, setData] = useState<Snapshot>({ homes: [], recent: [] });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/funeral-homes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Snapshot | null) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(method: "POST" | "DELETE", body: unknown) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/funeral-homes", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as Snapshot);
      setError(false);
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (name.trim().length < 2) return;
    if (await send("POST", { name: name.trim(), address })) setName("");
  }

  function remove(home: FuneralHome) {
    if (!window.confirm(t("funeral_home_remove_confirm", { name: home.name }))) return;
    void send("DELETE", { id: home.id });
  }

  const hasStreet = address.street1.trim().length >= 3 && address.city.trim().length >= 2 && /^\d{5}/.test(address.zip);
  const isSaved = data.homes.some((h) => sameAddress(h.address, address));
  const chip = (selected: boolean) =>
    `flex items-center gap-2 text-left px-3 py-2 rounded-xl border transition ${
      selected ? "border-ink bg-white shadow-sm" : "border-mute-200 bg-bone hover:border-ink/40"
    }`;

  return (
    <div className="mt-2 rounded-xl border border-mute-200 bg-white/60 p-3">
      <div className="text-[11px] uppercase tracking-widest text-mute-400 mb-1.5">{t("funeral_homes_label")}</div>
      {data.homes.length === 0 && data.recent.length === 0 && (
        <p className="text-xs text-mute-400 mb-2">{t("funeral_homes_empty")}</p>
      )}
      {data.homes.length > 0 && (
        <div className="grid gap-1.5 mb-2">
          {data.homes.map((h) => {
            const selected = sameAddress(h.address, address);
            return (
              <div key={h.id} className={chip(selected)}>
                <button type="button" onClick={() => onPick({ ...h.address })} className="min-w-0 flex-1 text-left" aria-pressed={selected}>
                  <span className="block text-sm text-ink truncate">{selected ? "✓ " : ""}{h.name}</span>
                  <span className="block text-[11px] text-mute-500 truncate">
                    {h.address.street1}, {h.address.city}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(h)}
                  aria-label={t("funeral_home_remove", { name: h.name })}
                  className="shrink-0 text-mute-400 hover:text-ink"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {data.recent.length > 0 && (
        <>
          <div className="text-[11px] text-mute-400 mb-1">{t("funeral_homes_recent")}</div>
          <div className="grid gap-1.5 mb-2">
            {data.recent.map((r) => {
              const selected = sameAddress(r.address, address);
              return (
                <button key={`${r.address.street1}|${r.address.zip}`} type="button" onClick={() => onPick({ ...r.address })} className={chip(selected)} aria-pressed={selected}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink truncate">{selected ? "✓ " : ""}{r.address.street1}</span>
                    <span className="block text-[11px] text-mute-500">{r.address.city}, {r.address.state} {r.address.zip}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-mute-500">×{r.orderCount}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {hasStreet && !isSaved && (
        <div className="flex gap-2 items-center">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("funeral_home_name_placeholder")}
            aria-label={t("funeral_home_name_placeholder")}
            className="min-w-0 flex-1 p-2.5 rounded-lg bg-bone border border-mute-200 text-sm outline-none focus:border-ink focus:bg-white"
          />
          <button
            type="button"
            disabled={busy || name.trim().length < 2}
            onClick={() => void save()}
            className="shrink-0 px-3 py-2 rounded-lg border border-ink/30 text-sm text-ink disabled:opacity-40"
          >
            {t("funeral_home_save")}
          </button>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs text-error">{t("funeral_homes_error")}</p>}
    </div>
  );
}
