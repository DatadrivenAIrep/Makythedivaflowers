// components/legal/LegalShell.tsx
type Section = { heading: string; body: string[] };
type Props = { title: string; updated: string; sections: Section[] };

export function LegalShell({ title, updated, sections }: Props) {
  return (
    <main className="pt-32 pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <header className="mb-16 border-b border-ink/10 pb-10">
          <h1 className="font-display text-5xl sm:text-6xl text-ink leading-[0.92] tracking-tighter">{title}</h1>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-ink/50">{updated}</p>
        </header>
        <div className="space-y-14">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-3xl text-ink tracking-tighter mb-4">{s.heading}</h2>
              <div className="space-y-4">
                {s.body.map((p, i) => (
                  <p key={i} className="text-base text-ink/75 leading-relaxed max-w-[68ch]">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
