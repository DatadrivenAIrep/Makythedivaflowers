"use client";
import { useState, type FormEvent } from "react";
import { findDeliveryZoneByZip, isValidZip } from "@/lib/delivery-zones";
import { trackZipCheckPass, trackZipCheckFail } from "@/lib/analytics";
import type { Locale } from "@/types/locale";

type Result =
  | { kind: "pass"; zip: string; zoneLabel: string }
  | { kind: "fail"; zip: string }
  | { kind: "invalid" }
  | { kind: "idle" };

export function ZipChecker({ locale }: { locale: Locale }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const zip = value.trim();
    if (!isValidZip(zip)) {
      setResult({ kind: "invalid" });
      return;
    }
    const zone = findDeliveryZoneByZip(zip);
    if (zone) {
      const label = zone.label[locale];
      trackZipCheckPass({ zip, zoneId: zone.id });
      setResult({ kind: "pass", zip, zoneLabel: label });
    } else {
      trackZipCheckFail({ zip });
      setResult({ kind: "fail", zip });
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          placeholder="Enter your ZIP"
          aria-label="Enter your ZIP"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult({ kind: "idle" });
          }}
          className="flex-1 rounded-md border border-ink/20 bg-bone px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-bone hover:bg-ink/90"
        >
          Check
        </button>
      </div>
      {result.kind === "pass" && (
        <p className="text-sm text-ink">&#10003; We deliver to {result.zoneLabel}</p>
      )}
      {result.kind === "fail" && (
        <p className="text-sm text-ink">
          Sorry, we don&apos;t deliver to {result.zip} yet &mdash;{" "}
          <a className="underline" href={`/${locale}/contact`}>
            Contact us for special requests
          </a>
        </p>
      )}
      {result.kind === "invalid" && (
        <p className="text-sm text-ink/70">Please enter a 5-digit ZIP.</p>
      )}
    </form>
  );
}
