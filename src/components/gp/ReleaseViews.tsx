import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RadarEntry } from "@/domain/types";
import { dayKey, formatReleaseDate, isCountdownable, shortDayLabel } from "@/domain/release";
import { useI18n } from "@/i18n/I18nProvider";
import { PlatformBadgeList } from "./PlatformBadge";
import { ReleaseStatusBadge, ReleaseKindBadge } from "./ReleaseStatusBadge";
import { WishlistButton } from "./WishlistButton";
import { CountdownChip } from "./CountdownCard";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

function groupByDay(entries: RadarEntry[]) {
  const map = new Map<string, RadarEntry[]>();
  for (const entry of entries) {
    const key = dayKey(entry.event.date);
    const bucket = map.get(key);
    if (bucket) bucket.push(entry);
    else map.set(key, [entry]);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/** Vertical day-by-day spine — the reading view for a long release window. */
export function TimelineView({ entries }: { entries: RadarEntry[] }) {
  const { t, locale } = useI18n();
  const groups = useMemo(() => groupByDay(entries), [entries]);

  if (!groups.length) return <EmptyState title={t("empty.title")} body={t("empty.body")} />;

  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {groups.map(([key, items]) => (
        <li key={key} className="relative">
          <span
            aria-hidden
            className="absolute -left-[1.68rem] top-1.5 size-2.5 rounded-full bg-accent ring-4 ring-background"
          />
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-foreground">
              {new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" }).format(
                new Date(key),
              )}
            </h3>
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {items.length}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map(({ game, event }) => (
              <Link
                key={event.id}
                to="/game/$slug"
                params={{ slug: game.slug }}
                className="gp-panel flex items-center gap-3 p-2.5 transition-colors hover:border-accent/60"
              >
                <img
                  src={game.coverUrl}
                  alt=""
                  loading="lazy"
                  className="size-12 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{game.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <ReleaseKindBadge kind={event.kind} />
                    <PlatformBadgeList platforms={event.platforms} max={3} />
                  </div>
                </div>
                <ReleaseStatusBadge confidence={event.confidence} />
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Dense scannable list — one row per release, sorted by date. */
export function AgendaView({ entries }: { entries: RadarEntry[] }) {
  const { t, locale } = useI18n();
  const rows = useMemo(
    () => [...entries].sort((a, b) => a.event.date.localeCompare(b.event.date)),
    [entries],
  );

  if (!rows.length) return <EmptyState title={t("empty.title")} body={t("empty.body")} />;

  return (
    <div className="gp-panel divide-y divide-border">
      {rows.map(({ game, event }) => (
        <div key={event.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
            {formatReleaseDate(event.date, event.precision, locale)}
          </div>
          <Link
            to="/game/$slug"
            params={{ slug: game.slug }}
            className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground transition-colors hover:text-accent"
          >
            {game.title}
          </Link>
          <ReleaseKindBadge kind={event.kind} />
          <PlatformBadgeList platforms={event.platforms} max={4} />
          <ReleaseStatusBadge confidence={event.confidence} />
          {event.state === "delayed" && event.delayDays ? (
            <span className="rounded-md bg-destructive/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-destructive">
              +{event.delayDays}d
            </span>
          ) : null}
          <WishlistButton gameId={game.id} />
        </div>
      ))}
    </div>
  );
}

/** Calendar grid for one month, paged from the earliest release month. */
export function MonthView({
  entries,
  referenceDate,
}: {
  entries: RadarEntry[];
  referenceDate: string;
}) {
  const { t, locale } = useI18n();
  const ref = new Date(referenceDate);
  const [offset, setOffset] = useState(0);

  const cursor = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + offset, 1));
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = new Date(Date.UTC(year, month, 1)).getUTCDay();

  const byDay = useMemo(() => groupByDay(entries), [entries]);
  const lookup = new Map(byDay);

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    shortDayLabel(new Date(Date.UTC(2024, 8, 1 + i)).toISOString(), locale),
  );

  return (
    <div className="gp-panel p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-foreground">
          {new Intl.DateTimeFormat(locale, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(cursor)}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t("radar.prev")}
            onClick={() => setOffset((o) => o - 1)}
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label={t("radar.next")}
            onClick={() => setOffset((o) => o + 1)}
            className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <ChevronRight aria-hidden className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekdays.map((d) => (
          <div
            key={d}
            className="pb-1 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const items = lookup.get(key) ?? [];
          const isToday = key === dayKey(referenceDate);
          return (
            <div
              key={key}
              className={cn(
                "min-h-[84px] rounded-lg border p-1.5 transition-colors",
                isToday ? "border-accent bg-accent-soft" : "border-border bg-surface-2/40",
              )}
            >
              <div
                className={cn(
                  "font-mono text-[11px]",
                  isToday ? "font-bold text-accent" : "text-muted-foreground",
                )}
              >
                {String(day).padStart(2, "0")}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {items.slice(0, 3).map(({ game, event }) => (
                  <Link
                    key={event.id}
                    to="/game/$slug"
                    params={{ slug: game.slug }}
                    title={game.title}
                    className="block size-7 overflow-hidden rounded border border-border transition-transform hover:scale-110"
                  >
                    <img src={game.coverUrl} alt={game.title} className="size-full object-cover" />
                  </Link>
                ))}
                {items.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{items.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Live countdown board for every release with a precise enough date. */
export function CountdownView({ entries }: { entries: RadarEntry[] }) {
  const { t } = useI18n();
  const rows = useMemo(
    () =>
      entries
        .filter(({ event }) => isCountdownable(event))
        .sort((a, b) => a.event.date.localeCompare(b.event.date)),
    [entries],
  );

  if (!rows.length) return <EmptyState title={t("empty.title")} body={t("empty.body")} />;

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ game, event }) => (
        <CountdownChip key={event.id} game={game} event={event} />
      ))}
    </div>
  );
}
