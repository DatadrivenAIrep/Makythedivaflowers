// components/contact/DeliveryZonePills.tsx
import { getTranslations } from "next-intl/server";
import { deliveryZones } from "@/data/delivery-zones";
import type { Locale } from "@/types/locale";

export async function DeliveryZonePills({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.zones" });
  return (
    <section className="py-16 border-t border-ink/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-4xl text-ink leading-[0.95] tracking-tighter">{t("title")}</h2>
        </header>
        <ul className="flex flex-wrap gap-3">
          {deliveryZones.map((zone) => (
            <li key={zone.id} className="rounded-full border border-ink/15 bg-bone px-5 py-2 text-sm text-ink/80">
              {zone.label[locale]}
            </li>
          ))}
        </ul>
        <p className="mt-6 font-mono text-[11px] text-ink/50 uppercase tracking-[0.18em]">{t("note")}</p>
      </div>
    </section>
  );
}
