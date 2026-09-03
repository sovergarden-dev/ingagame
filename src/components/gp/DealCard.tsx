import { Link } from "@tanstack/react-router";
import type { Deal } from "@/domain/types";
import { getGame } from "@/domain/mock-data";
import { cn } from "@/lib/utils";

function money(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

export function DealCard({
  deal,
  locale = "en-US",
  featured = false,
  className,
}: {
  deal: Deal;
  locale?: string;
  featured?: boolean;
  className?: string;
}) {
  const game = getGame(deal.gameId);
  if (!game) return null;

  if (featured) {
    return (
      <Link
        to="/game/$slug"
        params={{ slug: game.slug }}
        className={cn(
          "group relative block overflow-hidden rounded-xl border border-border",
          className,
        )}
      >
        <img
          src={game.coverUrl}
          alt=""
          loading="lazy"
          width={600}
          height={900}
          className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <span className="absolute right-2 top-2 rounded-md bg-success px-1.5 py-0.5 text-[11px] font-bold text-background">
          -{deal.discountPercent}%
        </span>
        <div className="absolute inset-x-3 bottom-2">
          <p className="truncate text-sm font-semibold text-foreground">{game.title}</p>
          <p className="text-xs">
            <span className="font-semibold text-foreground">
              {money(deal.priceCurrent, deal.currency, locale)}
            </span>{" "}
            <span className="text-muted-foreground line-through">
              {money(deal.priceBase, deal.currency, locale)}
            </span>
          </p>
        </div>
      </Link>
    );
  }

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
        className="size-10 shrink-0 rounded-md border border-border object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground group-hover:text-accent">
          {game.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{deal.store}</p>
      </div>
      <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-success">
        -{deal.discountPercent}%
      </span>
      <span className="w-16 text-right text-sm font-semibold text-foreground">
        {money(deal.priceCurrent, deal.currency, locale)}
      </span>
    </Link>
  );
}
