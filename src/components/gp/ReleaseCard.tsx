import { Link } from "@tanstack/react-router";
import type { Game, ReleaseEvent } from "@/domain/types";
import { formatReleaseDate } from "@/domain/release";
import { PlatformBadgeList } from "./PlatformBadge";
import { ReleaseKindBadge } from "./ReleaseStatusBadge";
import { WishlistButton } from "./WishlistButton";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Dense portrait card used by the Release Radar rail. */
export function ReleaseCard({
  game,
  event,
  className,
}: {
  game: Game;
  event: ReleaseEvent;
  className?: string;
}) {
  const { locale } = useI18n();
  const exactTime =
    event.precision === "exact"
      ? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(
          new Date(event.date),
        )
      : null;

  return (
    <article className={cn("group/card relative w-[150px] shrink-0 sm:w-[164px]", className)}>
      <Link
        to="/game/$slug"
        params={{ slug: game.slug }}
        className="block rounded-xl focus-visible:outline-none"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface-2 transition-[transform,border-color,box-shadow] duration-200 group-hover/card:-translate-y-1 group-hover/card:border-accent/60 group-focus-within/card:border-accent">
          <img
            src={game.coverUrl}
            alt={`${game.title} cover art`}
            loading="lazy"
            width={600}
            height={900}
            className="size-full object-cover"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/90 to-transparent" />
          {event.state === "delayed" && (
            <span className="absolute left-2 top-2 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-destructive-foreground">
              +{event.delayDays}d
            </span>
          )}
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover/card:text-accent">
          {game.title}
        </h3>
      </Link>

      <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100 max-md:opacity-100">
        <WishlistButton gameId={game.id} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <PlatformBadgeList platforms={event.platforms} max={3} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <ReleaseKindBadge kind={event.kind} />
        {exactTime && (
          <span className="font-mono text-[11px] text-muted-foreground">{exactTime}</span>
        )}
        {!exactTime && event.precision !== "date" && (
          <span className="text-[11px] text-muted-foreground">
            {formatReleaseDate(event.date, event.precision, locale)}
          </span>
        )}
      </div>
    </article>
  );
}
