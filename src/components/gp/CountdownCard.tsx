import { CalendarPlus, PlayCircle, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Game, ReleaseEvent } from "@/domain/types";
import { countdownFrom, formatReleaseDate, isCountdownable } from "@/domain/release";
import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/library/LibraryProvider";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "./PlatformBadge";
import { ReleaseStatusBadge, ReleaseStateBadge } from "./ReleaseStatusBadge";
import { WishlistButton } from "./WishlistButton";
import { cn } from "@/lib/utils";

function Unit({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="min-w-[62px] rounded-lg border border-border bg-background/55 px-3 py-2 text-center backdrop-blur-sm sm:min-w-[76px]">
      <div className="font-mono text-2xl font-semibold leading-none tabular-nums text-foreground sm:text-3xl">
        {typeof value === "number" ? String(value).padStart(2, "0") : value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** Timer digits. Renders placeholders until hydrated to avoid mismatch. */
export function CountdownUnits({ target }: { target: string }) {
  const { t } = useI18n();
  const now = useNow();
  const parts = now === null ? null : countdownFrom(target, now);
  return (
    <div className="flex flex-wrap gap-2">
      <Unit value={parts ? parts.days : "--"} label={t("countdown.days")} />
      <Unit value={parts ? parts.hours : "--"} label={t("countdown.hours")} />
      <Unit value={parts ? parts.minutes : "--"} label={t("countdown.minutes")} />
      <Unit value={parts ? parts.seconds : "--"} label={t("countdown.seconds")} />
    </div>
  );
}

/** Full-bleed hero countdown for the flagship next release. */
export function CountdownHero({
  game,
  event,
  backdropUrl,
}: {
  game: Game;
  event: ReleaseEvent;
  backdropUrl: string;
}) {
  const { t, locale } = useI18n();
  const { isFollowing, toggleFollow } = useLibrary();
  const following = isFollowing(game.id);
  const countdownable = isCountdownable(event) && event.state !== "available";

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <img
        src={backdropUrl}
        alt=""
        width={1920}
        height={1088}
        fetchPriority="high"
        className="absolute inset-0 size-full object-cover object-center"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(100deg, var(--background) 6%, oklch(from var(--background) l c h / 0.86) 42%, oklch(from var(--background) l c h / 0.15) 82%)",
        }}
      />
      {/* Vertical scrim keeps text legible on narrow screens where the art sits behind the copy. */}
      <div
        aria-hidden
        className="absolute inset-0 lg:hidden"
        style={{
          background:
            "linear-gradient(to top, var(--background) 18%, oklch(from var(--background) l c h / 0.82) 62%, oklch(from var(--background) l c h / 0.45) 100%)",
        }}
      />
      <div className="relative p-6 sm:p-9 lg:p-12">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="gp-eyebrow">{t("countdown.eyebrow")}</p>
            <ReleaseStatusBadge confidence={event.confidence} />
            <ReleaseStateBadge
              state={event.state}
              {...(event.delayDays ? { delayDays: event.delayDays } : {})}
            />
          </div>

          <h1
            id="hero-title"
            className="mt-3 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            {game.title}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            {game.summary}
          </p>

          <div className="mt-6">
            {countdownable ? (
              <>
                <p className="gp-eyebrow mb-2">{t("countdown.eyebrow")}</p>
                <CountdownUnits target={event.date} />
              </>
            ) : (
              <p className="rounded-lg border border-border bg-background/55 px-4 py-3 text-sm text-muted-foreground">
                {event.state === "available"
                  ? t("countdown.availableNow")
                  : t("countdown.noExactTime")}
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              {formatReleaseDate(event.date, event.precision, locale)}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {event.platforms.map((p) => (
              <PlatformBadge key={p} platform={p} size="md" showLabel />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <WishlistButton gameId={game.id} variant="full" />
            <Button
              variant="glass"
              size="lg"
              onClick={() => toggleFollow(game.id)}
              aria-pressed={following}
            >
              <Star className={cn(following && "fill-current")} />
              {following ? t("action.following") : t("action.follow")}
            </Button>
            <Button variant="glass" size="lg">
              <PlayCircle />
              {t("action.trailer")}
            </Button>
            <Button variant="glass" size="lg" className="hidden sm:inline-flex">
              <CalendarPlus />
              {t("action.addToCalendar")}
            </Button>
            <Button asChild variant="quiet" size="lg">
              <Link to="/game/$slug" params={{ slug: game.slug }}>
                {t("action.viewDetails")}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Compact pinned countdown chip, e.g. in the sidebar or a sticky bar. */
export function CountdownChip({ game, event }: { game: Game; event: ReleaseEvent }) {
  const { t, locale } = useI18n();
  const now = useNow();
  const parts = now !== null && isCountdownable(event) ? countdownFrom(event.date, now) : null;

  return (
    <Link
      to="/game/$slug"
      params={{ slug: game.slug }}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 p-2.5 transition-colors hover:border-accent/60"
    >
      <img
        src={game.coverUrl}
        alt=""
        loading="lazy"
        width={600}
        height={900}
        className="size-11 shrink-0 rounded-md border border-border object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-accent">
          {game.title}
        </p>
        <p className="truncate font-mono text-xs tabular-nums text-accent">
          {parts
            ? parts.elapsed
              ? t("countdown.availableNow")
              : `${parts.days}d ${String(parts.hours).padStart(2, "0")}h ${String(parts.minutes).padStart(2, "0")}m`
            : formatReleaseDate(event.date, event.precision, locale)}
        </p>
      </div>
    </Link>
  );
}
