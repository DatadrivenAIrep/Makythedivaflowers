import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Locale } from "@/types/locale";
import { TIKTOKS } from "@/data/tiktoks";
import { TikTokCard } from "./TikTokCard";

const TIKTOK_PROFILE_URL = "https://www.tiktok.com/@makythediva";

export async function TikTokStrip({ locale }: { locale: Locale }) {
  if (TIKTOKS.length === 0) return null;
  const t = await getTranslations("home.tiktok");

  return (
    <section className="bg-petal text-ink">
      <div className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-28">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 font-display italic text-4xl md:text-5xl tracking-tighter leading-[0.95]">
              {t("title")}
            </h2>
          </div>
          <Link
            href={TIKTOK_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm tracking-tight text-ink underline underline-offset-4 hover:no-underline whitespace-nowrap"
          >
            @makythediva →
          </Link>
        </div>

        <ul className="flex md:grid md:grid-cols-4 gap-3 -mx-6 px-6 md:mx-0 md:px-0 overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none scroll-pl-6">
          {TIKTOKS.map((video) => (
            <li
              key={video.slug}
              className="shrink-0 w-[78vw] sm:w-[60vw] md:w-auto snap-start"
            >
              <TikTokCard video={video} locale={locale} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
