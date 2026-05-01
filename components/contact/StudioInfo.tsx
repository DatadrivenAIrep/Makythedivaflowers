// components/contact/StudioInfo.tsx
import { getTranslations } from "next-intl/server";
import { SITE } from "@/data/site";
import { formatAddressLine, formatPhoneUS } from "@/lib/format";
import type { Locale } from "@/types/locale";

export async function StudioInfo({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.studio" });
  const address = formatAddressLine(SITE.address);
  return (
    <dl className="space-y-6">
      <div>
        <dt className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
          {t("address_label")}
        </dt>
        <dd className="mt-1 font-display text-2xl text-ink leading-snug">
          {t("address_value", { address })}
        </dd>
      </div>
      <div>
        <dt className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
          {t("hours_label")}
        </dt>
        <dd className="mt-1 font-display text-2xl text-ink leading-snug space-y-1">
          {SITE.hours.map((row) => (
            <div key={row.day}>
              <span className="text-ink/55">{row.day}</span>{" "}
              <span>{row.value}</span>
            </div>
          ))}
        </dd>
      </div>
      <div>
        <dt className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
          {t("phone_label")}
        </dt>
        <dd className="mt-1 font-display text-2xl text-ink leading-snug">
          {formatPhoneUS(SITE.phone)}
        </dd>
      </div>
      <div>
        <dt className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
          {t("email_label")}
        </dt>
        <dd className="mt-1 font-display text-2xl text-ink leading-snug">
          {SITE.email}
        </dd>
      </div>
    </dl>
  );
}
