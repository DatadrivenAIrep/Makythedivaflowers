// components/editorial/ZigZagItem.tsx
import Link from "next/link";
import Image from "next/image";
type Props = { href: string; title: string; excerpt: string; date: string; cover: { src: string; alt: string }; reverse?: boolean; featured?: boolean };
export function ZigZagItem({ href, title, excerpt, date, cover, reverse, featured }: Props) {
  return (
    <Link
      href={href}
      className={`group grid items-center gap-8 ${featured ? "lg:grid-cols-1" : "lg:grid-cols-2"} ${reverse && !featured ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      <div className={`overflow-hidden rounded-2xl bg-bone ${featured ? "aspect-[16/9]" : "aspect-[4/5]"}`}>
        <Image
          src={cover.src}
          alt={cover.alt}
          width={1600}
          height={featured ? 900 : 1200}
          sizes={featured ? "100vw" : "(max-width: 1024px) 100vw, 50vw"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] motion-reduce:transition-none"
        />
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">{date}</p>
        <h3 className={`mt-3 font-display text-ink leading-[0.95] tracking-tighter ${featured ? "text-6xl sm:text-7xl" : "text-3xl sm:text-4xl"}`}>{title}</h3>
        <p className="mt-4 text-ink/75 max-w-[58ch]">{excerpt}</p>
      </div>
    </Link>
  );
}
