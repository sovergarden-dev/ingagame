import { Link } from "@tanstack/react-router";
import type { Deal } from "@/domain/types";
import { isDealExpired } from "@/domain/deal";
import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/i18n/I18nProvider";
import { useGameTitle } from "./use-game-title";
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
  const game = deal.game;
  const title = useGameTitle(game ?? { title: deal.store });
  const now = useNow();
  const { t } = useI18n();
  const expired = isDealExpired(deal.endsAt, now);
  const discountLabel = expired ? t("deals.alert.title") : `-${deal.discountPercent}%`;

  if (!game) {
    return (
      <div
        className={cn(
          "flex min-h-14 items-center gap-3 rounded-lg border border-transparent p-2",
          expired && "opacity-80",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{deal.store}</p>
        </div>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-xs font-semibold",
            expired ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success",
          )}
        >
          {discountLabel}
        </span>
        <span className="w-[68px] shrink-0 text-right text-sm font-semibold text-foreground">
          {money(deal.priceCurrent, deal.currency, locale)}
        </span>
      </div>
    );
  }

  if (featured) {
    return (
      <Link
        to="/game/$slug"
        params={{ slug: game.slug }}
        className={cn(
          "group relative block overflow-hidden rounded-xl border border-border",
          expired && "opacity-80",
          className,
        )}
      >
        <img
          src={game.coverUrl}
          alt=""
          loading="lazy"
          width={600}
          height={900}
          className="h-36 w-full object-cover sm:h-32 transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <div className="gp-cover-scrim absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <span
          className={cn(
            "absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
            expired ? "bg-destructive text-destructive-foreground" : "bg-success text-background",
          )}
        >
          {discountLabel}
        </span>
        <div className="absolute inset-x-3 bottom-2">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
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
        "group flex min-h-14 items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-surface-2/70",
        expired && "opacity-80",
        className,
      )}
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
          {title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{deal.store}</p>
      </div>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-xs font-semibold",
          expired ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success",
        )}
      >
        {discountLabel}
      </span>
      <span className="w-[68px] shrink-0 text-right text-sm font-semibold text-foreground">
        {money(deal.priceCurrent, deal.currency, locale)}
      </span>
    </Link>
  );
}
