// components/contact/StudioInfo.tsx
import { getTranslations } from "next-intl/server";
import { formatPhoneUS } from "@/lib/format";
import type { Locale } from "@/types/locale";

export async function StudioInfo({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.studio" });
  const items = [
    { label: t("address_label"), value: t("address_value") },
    { label: t("hours_label"),   value: t("hours_value") },
    { label: t("phone_label"),   value: formatPhoneUS("5164843456") },
    { label: t("email_label"),   value: "hello@divaflowers.com" },
  ];
  return (
    <dl className="space-y-6">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">{i.label}</dt>
          <dd className="mt-1 font-display text-2xl text-ink leading-snug">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
