// components/editorial/Figure.tsx
import Image from "next/image";
type Props = { src: string; alt: string; caption?: string; aspect?: "4/5" | "1/1" | "16/9" | "3/2"; align?: "left" | "right" | "full" };
export function Figure({ src, alt, caption, aspect = "4/5", align = "full" }: Props) {
  const widthClass = align === "full" ? "max-w-3xl mx-auto" : align === "left" ? "sm:float-left sm:mr-8 sm:mb-4 max-w-md" : "sm:float-right sm:ml-8 sm:mb-4 max-w-md";
  return (
    <figure className={`my-10 ${widthClass}`}>
      <div className="overflow-hidden rounded-2xl bg-bone" style={{ aspectRatio: aspect.replace("/", " / ") }}>
        <Image src={src} alt={alt} width={1200} height={1500} className="h-full w-full object-cover" sizes="(max-width: 768px) 100vw, 768px" />
      </div>
      {caption && <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">{caption}</figcaption>}
    </figure>
  );
}
