"use client";
import { memo, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type NycParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function getNycParts(): NycParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(get("hour"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: hour === 24 ? 0 : hour,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: wkMap[get("weekday")] ?? 0,
  };
}

function formatHHMM(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function format12h(h: number, m: number): string {
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function hoursForDay(weekday: number): { open: number; close: number } {
  if (weekday === 0) return { open: 10, close: 16 };
  if (weekday === 6) return { open: 9, close: 18 };
  return { open: 9, close: 19 };
}

function AnalogClock({ h, m }: { h: number; m: number }) {
  const hourAngle = ((h % 12) + m / 60) * 30;
  const minAngle = m * 6;
  return (
    <svg viewBox="0 0 32 32" className="size-8 text-bone/80" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeOpacity="0.25" />
      <line
        x1="16"
        y1="16"
        x2="16"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${hourAngle} 16 16)`}
      />
      <line
        x1="16"
        y1="16"
        x2="16"
        y2="6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        transform={`rotate(${minAngle} 16 16)`}
      />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function BentoStudioClockImpl() {
  const t = useTranslations("home.bento");
  const [now, setNow] = useState<NycParts | null>(null);

  useEffect(() => {
    setNow(getNycParts());
    const id = setInterval(() => setNow(getNycParts()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div className="relative bg-charcoal text-bone rounded-[var(--radius-bento)] p-6 md:p-7 min-h-[140px] h-full flex flex-col justify-between gap-4 shadow-[var(--shadow-tile-rest)] overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
            {t("clock_label")}
          </span>
        </div>
        <span className="font-mono text-3xl md:text-4xl tracking-tighter text-bone">--:--</span>
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-mute-400" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/70">—</span>
        </div>
      </div>
    );
  }

  const { hour, minute, weekday } = now;
  const totalMin = hour * 60 + minute;
  const todayHours = hoursForDay(weekday);
  const isOpen = totalMin >= todayHours.open * 60 && totalMin < todayHours.close * 60;
  const closesAt = format12h(todayHours.close, 0);
  const beforeOpen = totalMin < todayHours.open * 60;
  const opensLabel = beforeOpen
    ? format12h(todayHours.open, 0)
    : format12h(hoursForDay((weekday + 1) % 7).open, 0);

  return (
    <div className="relative bg-charcoal text-bone rounded-[var(--radius-bento)] p-6 md:p-7 min-h-[140px] h-full flex flex-col justify-between gap-4 shadow-[var(--shadow-tile-rest)] overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/60">
          {t("clock_label")}
        </span>
        <AnalogClock h={hour} m={minute} />
      </div>
      <span className="font-mono text-3xl md:text-4xl tracking-tighter text-bone leading-none">
        {formatHHMM(hour, minute)}
      </span>
      <div className="flex items-center gap-2">
        <span className={cn("size-1.5 rounded-full", isOpen ? "bg-rouge" : "bg-mute-400")} />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone/70 leading-tight">
          {isOpen ? t("clock_open") : t("clock_closed")} ·{" "}
          {isOpen ? `${t("clock_closes_at")} ${closesAt}` : `${t("clock_opens_at")} ${opensLabel}`}
        </span>
      </div>
    </div>
  );
}

export const BentoStudioClock = memo(BentoStudioClockImpl);
