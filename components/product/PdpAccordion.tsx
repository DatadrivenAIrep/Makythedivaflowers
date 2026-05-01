"use client";
import { memo } from "react";
import { useTranslations } from "next-intl";
import { SITE } from "@/data/site";

// Source from data/site.ts so cutoff and delivery zones stay consistent
// across PDP, footer, legal copy, and metadata.
const DELIVERY_ZONES = SITE.deliveryZones.join(", ");
const CUTOFF = SITE.cutoffTime;

function Item({ label, body }: { label: string; body: string }) {
  return (
    <details className="group border-b border-ink/10 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-sans text-base text-ink">
        <span>{label}</span>
        <span className="font-mono text-xs text-mute-500 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-ink/75">{body}</p>
    </details>
  );
}

function PdpAccordionImpl() {
  const t = useTranslations("product.accordion");
  return (
    <div className="border-t border-ink/10">
      <Item label={t("stems_label")} body={t("stems_body")} />
      <Item label={t("sub_label")} body={t("sub_body")} />
      <Item
        label={t("delivery_label")}
        body={t("delivery_body", { zones: DELIVERY_ZONES, cutoff: CUTOFF })}
      />
    </div>
  );
}

export const PdpAccordion = memo(PdpAccordionImpl);
