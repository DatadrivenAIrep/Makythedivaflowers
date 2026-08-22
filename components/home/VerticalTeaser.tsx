// components/home/VerticalTeaser.tsx
import Image from "next/image";
import Link from "next/link";

export function VerticalTeaser({
  eyebrow, title, cta, imageSrc, href,
}: {
  eyebrow: string; title: string; cta: string;
  imageSrc: string; href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-[var(--radius-bento)] aspect-[16/9] text-bone"
    >
      <Image
        src={imageSrc} alt="" fill
        className="object-cover transition-transform duration-700 ease-[var(--ease-elegant)] group-hover:scale-[1.03]"
        sizes="(min-width: 768px) 50vw, 100vw"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/20 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/80">{eyebrow}</span>
        <h3 className="font-display text-2xl md:text-3xl leading-[1.05] tracking-tight mt-2">{title}</h3>
        <span className="mt-3 font-sans text-sm underline-offset-4 group-hover:underline">{cta} →</span>
      </div>
    </Link>
  );
}
