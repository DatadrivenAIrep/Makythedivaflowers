// components/home/GoogleReviewsCard.tsx

type GoogleReviewsCardProps = {
  author: string;
  initials: string;
  displayText: string;
  date: string;           // YYYY-MM
  locale: "en" | "es";
  occasion?: string;
  showTranslateChip: boolean;
  showingOriginal: boolean;
  translateLabel: string;
  originalLabel: string;
  onToggleTranslate: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
};

function formatDate(dateStr: string, locale: "en" | "es"): string {
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month || month < 1 || month > 12) return dateStr;
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1));
}

export function GoogleReviewsCard({
  author,
  initials,
  displayText,
  date,
  locale,
  occasion,
  showTranslateChip,
  showingOriginal,
  translateLabel,
  originalLabel,
  onToggleTranslate,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: GoogleReviewsCardProps) {
  const formattedDate = formatDate(date, locale);
  const meta = occasion ? `${formattedDate} · ${occasion}` : formattedDate;

  return (
    <>
      <p className="font-sans text-[32px] md:text-[44px] font-normal leading-[1.02] tracking-[-0.035em] max-w-[22ch] min-h-[6rem] md:min-h-[5rem]">
        {displayText}
      </p>

      <div className="flex items-center justify-between border-t border-mute-100 pt-5 mt-6">
        <div className="flex items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center w-9 h-9 rounded-full text-bone text-sm font-semibold select-none"
            style={{
              background:
                "linear-gradient(135deg, var(--color-petal), var(--color-rouge-glow))",
            }}
            aria-hidden="true"
          >
            {initials}
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight">{author}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute-500 mt-0.5">
              {meta}
            </p>
            {showTranslateChip && (
              <button
                type="button"
                onClick={onToggleTranslate}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute-400 hover:text-ink transition-colors mt-1"
              >
                {showingOriginal ? originalLabel : translateLabel}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label={prevLabel}
            onClick={onPrev}
            className="flex items-center justify-center w-9 h-9 rounded-full border border-mute-100 text-ink hover:border-mute-300 transition-colors"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            aria-label={nextLabel}
            onClick={onNext}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-ink text-bone hover:bg-charcoal transition-colors"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </>
  );
}
