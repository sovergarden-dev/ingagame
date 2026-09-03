import { Link } from "@tanstack/react-router";
import type { Game } from "@/domain/types";
import { formatReleaseDate } from "@/domain/release";
import { PlatformBadgeList } from "./PlatformBadge";
import { ReleaseStatusBadge } from "./ReleaseStatusBadge";
import { WishlistButton } from "./WishlistButton";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Standard poster card with metadata; used across discovery shelves. */
export function GameCard({ game, className }: { game: Game; className?: string }) {
  const { locale } = useI18n();
  const next = game.releaseEvents[0];

  return (
    <article className={cn("group/card relative w-[168px] shrink-0 sm:w-[190px]", className)}>
      <Link to="/game/$slug" params={{ slug: game.slug }} className="block rounded-xl">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface-2 transition-[transform,border-color] duration-200 group-hover/card:-translate-y-1 group-hover/card:border-accent/60">
          <img
            src={game.coverUrl}
            alt={`${game.title} cover art`}
            loading="lazy"
            width={600}
            height={900}
            className="size-full object-cover"
          />
        </div>
        <h3 className="mt-2 line-clamp-1 font-semibold text-foreground transition-colors group-hover/card:text-accent">
          {game.title}
        </h3>
      </Link>
      <div className="absolute right-2 top-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100 max-md:opacity-100">
        <WishlistButton gameId={game.id} />
      </div>
      <p className="line-clamp-1 text-xs text-muted-foreground">{game.developer}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <PlatformBadgeList platforms={game.platforms} max={3} />
      </div>
      {next && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <ReleaseStatusBadge confidence={next.confidence} interactive={false} />
          <span className="text-[11px] text-muted-foreground">
            {formatReleaseDate(next.date, next.precision, locale)}
          </span>
        </div>
      )}
    </article>
  );
}

/** Compact row card for dense panels and lists. */
export function GameCardCompact({
  game,
  trailing,
  className,
}: {
  game: Game;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const { locale } = useI18n();
  const next = game.releaseEvents[0];
  return (
    <Link
      to="/game/$slug"
      params={{ slug: game.slug }}
      className={cn(
        "group flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-surface-2/70",
        className,
      )}
    >
      <img
        src={game.coverUrl}
        alt=""
        loading="lazy"
        width={600}
        height={900}
        className="size-12 shrink-0 rounded-md border border-border object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-accent">
          {game.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {next ? formatReleaseDate(next.date, next.precision, locale) : game.developer}
        </p>
      </div>
      {trailing}
    </Link>
  );
}
