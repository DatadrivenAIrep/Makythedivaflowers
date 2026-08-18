"use client";
import { useState } from "react";
import { CheckCircle, WarningCircle, Eye, EyeSlash } from "@phosphor-icons/react/dist/ssr";

export type SecretFieldLabels = {
  current: string;
  notSet: string;
  save: string;
  saving: string;
  saved: string;
  error: string;
  delete: string;
};

type Props = {
  label: string;
  description?: string;
  placeholder: string;
  /** undefined = loading, null = not set, string = masked current value */
  currentMasked: string | null | undefined;
  minLength?: number;
  labels: SecretFieldLabels;
  onSave: (value: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

export default function SecretField({
  label,
  description,
  placeholder,
  currentMasked,
  minLength = 10,
  labels,
  onSave,
  onDelete,
}: Props) {
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    setStatus("saving");
    try {
      await onSave(input.trim());
      setStatus("saved");
      setInput("");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  async function remove() {
    setStatus("saving");
    try {
      await onDelete();
      setStatus("idle");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div>
      <label className="font-medium text-sm text-ink block mb-1">{label}</label>
      {description && <p className="text-sm text-mute-600 mb-3">{description}</p>}

      <div
        className={`mb-3 flex items-center gap-2 text-sm px-3 py-2 rounded-xl ${
          currentMasked ? "bg-green-50 text-green-800" : "bg-mute-100 text-mute-500"
        }`}
      >
        {currentMasked === undefined ? (
          <span className="animate-pulse">…</span>
        ) : currentMasked ? (
          <>
            <CheckCircle size={16} weight="fill" className="text-green-600 shrink-0" />
            <span>
              {labels.current} <code className="font-mono">{currentMasked}</code>
            </span>
            <button
              type="button"
              onClick={remove}
              className="ml-auto text-mute-500 hover:text-rouge text-xs underline"
            >
              {labels.delete}
            </button>
          </>
        ) : (
          <>
            <WarningCircle size={16} weight="fill" className="text-mute-400 shrink-0" />
            <span>{labels.notSet}</span>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? "text" : "password"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="w-full p-3.5 pr-10 rounded-xl bg-bone border border-mute-200 outline-none focus:border-ink focus:bg-white font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-mute-400 hover:text-ink"
            aria-label={show ? "Ocultar" : "Mostrar"}
          >
            {show ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="button"
          disabled={input.trim().length < minLength || status === "saving"}
          onClick={save}
          className="px-5 py-3 rounded-xl bg-rouge text-bone text-sm font-display disabled:opacity-40 transition"
        >
          {status === "saving"
            ? labels.saving
            : status === "saved"
            ? labels.saved
            : status === "error"
            ? labels.error
            : labels.save}
        </button>
      </div>
    </div>
  );
}
