"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { MagnifyingGlass, MapPin, User } from "@phosphor-icons/react/dist/ssr";
import type { Address } from "@/types/address";
import type { PlacesSuggestion } from "@/app/api/admin/places/autocomplete/route";

type CustomerSuggestion = {
  kind: "customer";
  label: string;
  address: Address;
  customerName: string;
};

type PlaceSuggestion = {
  kind: "place";
  placeId: string;
  mainText: string;
  secondaryText: string;
};

type Suggestion = CustomerSuggestion | PlaceSuggestion;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: Address) => void;
  placeholder?: string;
  className?: string;
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebounce(value, 280);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const [customersRes, placesRes] = await Promise.allSettled([
        fetch(`/api/admin/customers/search?address=${encodeURIComponent(q)}`).then((r) =>
          r.ok ? r.json() : { results: [] },
        ),
        fetch(`/api/admin/places/autocomplete?input=${encodeURIComponent(q)}`).then((r) =>
          r.ok ? r.json() : { suggestions: [] },
        ),
      ]);

      const customerItems: Suggestion[] = (
        customersRes.status === "fulfilled" ? (customersRes.value.results ?? []) : []
      ).map(
        (c: { name: string; address: Address }) => ({
          kind: "customer" as const,
          label: `${c.address.street1}, ${c.address.city}`,
          address: c.address,
          customerName: c.name,
        }),
      );

      const placeItems: Suggestion[] = (
        placesRes.status === "fulfilled" ? (placesRes.value.suggestions ?? []) : []
      ).map((p: PlacesSuggestion) => ({
        kind: "place" as const,
        placeId: p.placeId,
        mainText: p.mainText,
        secondaryText: p.secondaryText,
      }));

      // Customer matches first (already in our zone), then Google for new addresses.
      const all: Suggestion[] = [...customerItems, ...placeItems].slice(0, 7);
      setSuggestions(all);
      setOpen(all.length > 0);
      setActiveIdx(-1);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions(debouncedValue);
  }, [debouncedValue, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function selectSuggestion(s: Suggestion) {
    setOpen(false);
    if (s.kind === "customer") {
      onChange(s.address.street1);
      onSelect(s.address);
      return;
    }
    // Place — need to fetch details for structured address
    onChange(s.mainText);
    try {
      const res = await fetch(`/api/admin/places/detail?placeId=${encodeURIComponent(s.placeId)}`);
      if (!res.ok) return;
      const { address } = await res.json();
      if (address) onSelect(address);
    } catch {
      // ignore — user still has the typed text
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); selectSuggestion(suggestions[activeIdx]); }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mute-400 animate-spin">
          <MagnifyingGlass size={14} />
        </span>
      )}

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full top-full mt-1 bg-white border border-mute-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                className={`w-full flex items-start gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-bone transition ${i === activeIdx ? "bg-bone" : ""}`}
              >
                {s.kind === "customer" ? (
                  <User size={15} className="text-rouge shrink-0 mt-0.5" />
                ) : (
                  <MapPin size={15} className="text-mute-400 shrink-0 mt-0.5" />
                )}
                <span className="min-w-0">
                  <span className="block font-medium truncate">
                    {s.kind === "customer" ? s.label : s.mainText}
                  </span>
                  <span className="block text-mute-500 text-xs truncate">
                    {s.kind === "customer" ? s.customerName : s.secondaryText}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
