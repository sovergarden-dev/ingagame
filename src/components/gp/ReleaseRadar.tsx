import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RadarEntry } from "@/domain/types";
import { dayKey, shortDateLabel, shortDayLabel } from "@/domain/release";
import {
  matchesPlatformFilter,
  PLATFORM_FILTERS,
  isPlatformFilterId,
  type PlatformFilterId,
} from "@/domain/platforms";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { ReleaseCard } from "./ReleaseCard";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

/**
 * Flagship high-density horizontal release rail.
 * Groups by day, keyboard navigable, snap-scrolls on touch.
 */
export function ReleaseRadar({
  entries,
  referenceDate,
  className,
}: {
  entries: RadarEntry[];
  /** Stable "today" so SSR and client agree; the rail never reads Date.now(). */
  referenceDate: string;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const { myPlatforms } = usePreferences();
  const [filter, setFilter] = useState<PlatformFilterId>("all");
  const [filterReady, setFilterReady] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("inga.radarFilter");
    if (isPlatformFilterId(stored)) setFilter(stored);
    setFilterReady(true);
  }, []);

  useEffect(() => {
    if (!filterReady) return;
    window.localStorage.setItem("inga.radarFilter", filter);
  }, [filter, filterReady]);

  const groups = useMemo(() => {
    const filtered = entries.filter((e) =>
      matchesPlatformFilter(e.event.platforms, filter, myPlatforms),
    );
    const map = new Map<string, RadarEntry[]>();
    for (const entry of filtered) {
      const key = dayKey(entry.event.date);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return Array.from(map.entries());
  }, [entries, filter, myPlatforms]);

  const todayKey = dayKey(referenceDate);
  const tomorrowKey = dayKey(
    new Date(new Date(referenceDate).getTime() + 86_400_000).toISOString(),
  );

  function nudge(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.8, 280), behavior: "smooth" });
  }

  return (
    <section aria-labelledby="radar-heading" className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="radar-heading"
            className="text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl"
          >
            {(() => {
              const words = t("radar.title").split(" ");
              const tail = words.at(-1) ?? "";
              const lead = words.slice(0, -1).join(" ");
              return lead ? (
                <>
                  {lead} <span className="text-muted-foreground">{tail}</span>
                </>
              ) : (
                tail
              );
            })()}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t("radar.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label={t("filter.platforms")}
            className="gp-no-scrollbar flex max-w-[62vw] items-center gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 sm:max-w-none"
          >
            {PLATFORM_FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                type="button"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "h-7 shrink-0 rounded-full px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors",
                  filter === f.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {t(f.labelKey as MessageKey)}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label={t("radar.prev")}
              className="flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label={t("radar.next")}
              className="flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-colors hover:border-accent hover:text-accent"
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title={filter === "mine" ? t("radar.emptyPlatforms") : t("empty.title")}
          body={t("empty.body")}
        />
      ) : (
        <div
          ref={scroller}
          tabIndex={0}
          role="group"
          aria-label={t("radar.title")}
          className="gp-scroll-x flex snap-x snap-mandatory gap-6 pb-3 md:snap-none"
        >
          {groups.map(([key, items]) => {
            const label =
              key === todayKey
                ? t("radar.today")
                : key === tomorrowKey
                  ? t("radar.tomorrow")
                  : shortDateLabel(items[0]!.event.date, locale);
            return (
              <div key={key} className="snap-start">
                <div className="mb-2 flex items-baseline gap-2 border-b border-border pb-1.5">
                  <span className="font-display text-sm font-bold uppercase tracking-[0.14em] text-accent">
                    {label}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {shortDayLabel(items[0]!.event.date, locale)}
                  </span>
                </div>
                <div className="flex gap-3">
                  {items.map(({ game, event }) => (
                    <ReleaseCard key={event.id} game={game} event={event} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
