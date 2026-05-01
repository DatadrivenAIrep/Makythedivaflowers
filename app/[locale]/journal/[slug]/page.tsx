// app/[locale]/journal/[slug]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { journalArticles, getArticleBySlug } from "@/data/journal";
import type { Locale } from "@/types/locale";

export async function generateStaticParams() {
  return journalArticles.flatMap((a) =>
    (["en", "es"] as const).map((locale) => ({ locale, slug: a.slug })),
  );
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};
  return {
    title: article.seo.title[locale],
    description: article.seo.description[locale],
    alternates: { languages: { en: `/en/journal/${slug}`, es: `/es/journal/${slug}` } },
    openGraph: { title: article.title[locale], description: article.excerpt[locale], images: [{ url: article.cover.src }] },
  };
}

export default async function JournalArticlePage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();
  const t = await getTranslations({ locale, namespace: "journal.article" });
  return (
    <main className="pt-32 pb-24">
      <article>
        <header className="mx-auto max-w-3xl px-4 sm:px-6 mb-10">
          <Link href={`/${locale}/journal`} className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60 hover:text-ink">
            <ArrowLeft size={12} />
            {t("back")}
          </Link>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/60">
            {article.date} · {t("reading", { minutes: article.readingMinutes })}
          </p>
          <h1 className="mt-4 font-display text-5xl sm:text-7xl text-ink leading-[0.92] tracking-tighter">{article.title[locale]}</h1>
          <p className="mt-6 text-lg text-ink/75 max-w-[58ch]">{article.excerpt[locale]}</p>
        </header>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 mb-12">
          <div className="aspect-[16/9] overflow-hidden rounded-2xl bg-bone">
            <Image src={article.cover.src} alt={article.cover.alt[locale]} width={2400} height={1350} priority sizes="(max-width: 1024px) 100vw, 1024px" className="h-full w-full object-cover" />
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 space-y-6 text-base sm:text-lg text-ink/85">
          {article.body(locale)}
        </div>
      </article>
    </main>
  );
}
