import type { Locale } from "@/types/locale";

export function ShopHubHero({ locale }: { locale: Locale }) {
  const eyebrow = locale === "es" ? "La tienda" : "The shop";
  const title =
    locale === "es"
      ? "Cada arreglo, hecho a mano bajo el arco rosado."
      : "Every arrangement, made by hand under the pink arch.";
  const sub =
    locale === "es"
      ? "Ramos atados, plantas, regalos y suscripciones. Mismo día en Long Island y Queens."
      : "Hand-tied bouquets, plants, gifts, and subscriptions. Same-day across Long Island and Queens.";
  return (
    <header className="mx-auto max-w-[var(--container-max)] px-6 pt-16 pb-10 md:pt-24 md:pb-14">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mute-500">
        {eyebrow}
      </p>
      <h1 className="mt-3 max-w-3xl font-display text-5xl leading-[0.95] tracking-tighter text-ink md:text-7xl">
        {title}
      </h1>
      <p className="mt-5 max-w-xl font-sans text-base leading-relaxed text-ink/75 md:text-lg">
        {sub}
      </p>
    </header>
  );
}
