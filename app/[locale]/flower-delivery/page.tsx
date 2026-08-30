import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/types/locale";
import { LOCAL_CITIES, LOCAL_OCCASIONS } from "@/data/local-seo";
import { SITE } from "@/data/site";
import { localeAlternates } from "@/lib/seo/alternates";
import { BreadcrumbListLD } from "@/components/seo/BreadcrumbListLD";
import { Reveal } from "@/components/motion/Reveal";
import { Grain } from "@/components/brand/Grain";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const es = locale === "es";
  const towns = LOCAL_CITIES.map((c) => c.name).join(", ");
  return {
    title: es
      ? "Entrega de Flores en Nassau County, NY | Pueblos que Servimos | Diva Flowers"
      : "Flower Delivery Across Nassau County, NY | Towns We Serve | Diva Flowers",
    description: es
      ? `Entrega de flores el mismo día desde nuestro taller en ${SITE.address.locality}, NY a ${towns} y alrededores. Pide antes de las ${SITE.cutoffTime}.`
      : `Same-day flower delivery from our studio in ${SITE.address.locality}, NY to ${towns} and the surrounding villages. Order by ${SITE.cutoffTime}.`,
    alternates: localeAlternates(locale, "/flower-delivery"),
  };
}

export default async function FlowerDeliveryIndex({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const es = locale === "es";

  return (
    <main className="bg-bone text-ink">
      <BreadcrumbListLD
        items={[
          { name: es ? "Inicio" : "Home", href: `/${locale}` },
          { name: es ? "Entrega de flores" : "Flower delivery", href: `/${locale}/flower-delivery` },
        ]}
      />
      <Grain />
      <header className="relative isolate overflow-hidden bg-ink text-bone">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_0%,rgba(255,255,255,0.10),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-[var(--container-max)] px-6 pt-24 pb-16 md:pt-32 md:pb-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/70">
            Nassau County, NY
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[0.98] tracking-tighter md:text-6xl">
            {es
              ? "Dónde entregamos flores en Nassau County"
              : "Where we deliver flowers across Nassau County"}
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-bone/80 md:text-lg">
            {es
              ? `Todo sale de un solo taller en ${SITE.address.line1}, ${SITE.address.locality} — no somos un intermediario que reenvía tu pedido a otra floristería. Estos son los pueblos a los que llegamos a diario.`
              : `Everything leaves one studio at ${SITE.address.line1}, ${SITE.address.locality} — we are not a wire service handing your order to a florist you will never meet. These are the towns we reach daily.`}
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[var(--container-max)] px-6 py-20 md:py-24">
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {LOCAL_CITIES.map((c, i) => (
            <li key={c.slug}>
              <Reveal delay={i * 0.04}>
                <article className="flex h-full flex-col rounded-3xl border border-ink/10 p-6 transition-[border-color] [transition-duration:var(--motion-fast)] hover:border-ink/30">
                  <Link
                    href={`/${locale}/flower-delivery/${c.slug}`}
                    className="font-display text-2xl leading-tight tracking-tight hover:underline"
                  >
                    {c.name}, NY
                  </Link>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mute-500">
                    {c.zips.join(" · ")} · {es ? `${c.driveMinutes} min` : `${c.driveMinutes} min away`}
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {LOCAL_OCCASIONS.map((o) => (
                      <li key={o.slug}>
                        <Link
                          href={`/${locale}/flower-delivery/${c.slug}/${o.slug}`}
                          className="inline-block rounded-full border border-ink/15 px-3 py-1.5 font-sans text-xs text-ink/70 transition-[border-color,color] [transition-duration:var(--motion-fast)] hover:border-ink/40 hover:text-ink"
                        >
                          {o.label[locale]}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
