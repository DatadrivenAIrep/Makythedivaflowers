import { getTranslations } from "next-intl/server";
import { SITE } from "@/data/site";
import { TelLink } from "@/components/analytics/TelLink";
import { BloomImage } from "@/components/motion/BloomImage";
import type { Locale } from "@/types/locale";

// The page's one "come see us" block: the storefront under the pink arch,
// then address, hours and phone. "Get directions" opens Google Maps, which
// does a phone's job better than an embedded map would.
export async function StudioVisit({ locale: _locale }: { locale: Locale }) {
  const t = await getTranslations("home.studio");

  return (
    <section className="py-24 md:py-32">
      <div className="max-w-[1400px] mx-auto px-6 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-7 md:-ml-6">
          <BloomImage
            src="/storefront.webp"
            alt={t("photo_alt")}
            className="aspect-[4/3] rounded-[var(--radius-bento)]"
            sizes="(min-width: 1024px) 58vw, 100vw"
            imgClassName="object-[center_20%]"
          />
        </div>

        <div className="md:col-span-5 space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute-500">
            {t("eyebrow")}
          </p>
          <h2
            className="font-display text-4xl md:text-6xl tracking-tighter leading-[1.02]"
            style={{ fontVariationSettings: "'WONK' 1, 'SOFT' 70" }}
          >
            {t("title")}
          </h2>
          <p className="text-mute-600 max-w-[42ch] text-base leading-relaxed">{t("body")}</p>

          <div className="space-y-1 text-mute-600 text-base leading-relaxed">
            <p>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute-500 block mb-1">
                {t("address_label")}
              </span>
              {SITE.address.line1}
              <br />
              {SITE.address.locality}, {SITE.address.region} {SITE.address.postal}
            </p>
          </div>

          <div className="space-y-1 text-mute-600 text-base leading-relaxed">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute-500 mb-1">
              {t("hours_label")}
            </p>
            <ul className="space-y-1 font-mono text-[13px]">
              {SITE.hours.map((h) => (
                <li key={h.day}>
                  <span className="text-mute-500">{h.day}</span>{" "}
                  <span>{h.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute-500 mb-1">
              {t("phone_label")}
            </p>
            <TelLink
              href={SITE.phoneHref}
              location="home"
              className="font-mono text-[13px] hover:text-petal transition-colors"
            >
              {SITE.phoneDisplay}
            </TelLink>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={SITE.map.directionsHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit font-sans text-sm tracking-tight px-5 py-3 rounded-full bg-ink text-bone hover:opacity-90 transition-opacity"
            >
              {t("directions_cta")} →
            </a>
            <TelLink
              href={SITE.phoneHref}
              location="home"
              className="inline-flex w-fit font-sans text-sm tracking-tight px-5 py-3 rounded-full border border-ink/30 hover:border-ink transition-colors"
            >
              {t("call_cta")}
            </TelLink>
          </div>
        </div>
      </div>
    </section>
  );
}
