"use client";
import { useCallback, useState } from "react";
import type { Locale } from "@/types/locale";
import type { Occasion, Relation } from "@/schemas/card-message";
import { CardMessageSkeleton } from "./CardMessageSkeleton";

export type AssistCopy = {
  title: string;
  generate: string;
  regenerate: string;
  retry: string;
  close: string;
  errorGeneric: string;
  errorRateLimit: string;
};

type Props = {
  productTitle: string;
  occasion: Occasion;
  locale: Locale;
  relations: { key: string; label: string }[];
  copy: AssistCopy;
  onPick: (text: string) => void;
  onClose: () => void;
};

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; suggestions: string[] }
  | { kind: "error"; reason: "rate_limit" | "generic" };

export function CardMessageAssist({
  productTitle,
  occasion,
  locale,
  relations,
  copy,
  onPick,
  onClose,
}: Props) {
  const [relation, setRelation] = useState<Relation | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  const generate = useCallback(
    async (rel: Relation) => {
      setState({ kind: "loading" });
      try {
        const res = await fetch("/api/card-message", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productTitle, occasion, relation: rel, locale }),
        });
        if (res.status === 429) {
          setState({ kind: "error", reason: "rate_limit" });
          return;
        }
        if (!res.ok) {
          setState({ kind: "error", reason: "generic" });
          return;
        }
        const json = (await res.json()) as { suggestions: string[] };
        if (!Array.isArray(json.suggestions) || json.suggestions.length !== 3) {
          setState({ kind: "error", reason: "generic" });
          return;
        }
        setState({ kind: "success", suggestions: json.suggestions });
      } catch {
        setState({ kind: "error", reason: "generic" });
      }
    },
    [productTitle, occasion, locale],
  );

  const handleGenerate = useCallback(() => {
    if (relation) generate(relation);
  }, [relation, generate]);

  const handlePick = useCallback(
    (text: string) => {
      onPick(text);
    },
    [onPick],
  );

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-product)] border border-ink/10 bg-ink/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">{copy.title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="font-mono text-xs text-mute-500 hover:text-ink"
        >
          {copy.close}
        </button>
      </div>

      {state.kind === "idle" || state.kind === "error" ? (
        <div className="flex flex-wrap gap-2">
          {relations.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={relation === r.key}
              onClick={() => setRelation(r.key as Relation)}
              className={`rounded-full border px-3 py-1.5 font-sans text-sm transition-colors ${
                relation === r.key
                  ? "border-ink bg-ink text-bone"
                  : "border-ink/20 text-ink hover:border-ink/40"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}

      {state.kind === "idle" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!relation}
            className="rounded-[var(--radius-product)] bg-ink px-4 py-2 font-sans text-sm text-bone disabled:opacity-40"
          >
            {copy.generate}
          </button>
        </div>
      )}

      {state.kind === "loading" && <CardMessageSkeleton />}

      {state.kind === "success" && (
        <>
          <div className="flex flex-col gap-2">
            {state.suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handlePick(s)}
                className="rounded-[var(--radius-product)] border border-ink/15 px-4 py-3 text-left font-sans text-base leading-relaxed text-ink hover:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rouge"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              className="font-mono text-xs text-mute-500 hover:text-ink"
            >
              {copy.regenerate}
            </button>
          </div>
        </>
      )}

      {state.kind === "error" && (
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          <p className="font-sans text-sm text-ink">
            {state.reason === "rate_limit" ? copy.errorRateLimit : copy.errorGeneric}
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!relation}
              className="rounded-[var(--radius-product)] bg-ink px-4 py-2 font-sans text-sm text-bone disabled:opacity-40"
            >
              {copy.retry}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
