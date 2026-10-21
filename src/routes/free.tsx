import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { canonicalLinks } from "@/domain/seo";
import { Gift, Search, Timer } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { FilterChip } from "@/components/gp/FilterChip";
import { SteamOwnershipBadge } from "@/components/gp/SteamOwnershipBadge";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { EmptyState } from "@/components/gp/EmptyState";
import { FeedGate } from "@/components/gp/FeedGate";
import { PlatformBadgeList } from "@/components/gp/PlatformBadge";
import { WishlistButton } from "@/components/gp/WishlistButton";
import { Input } from "@/components/ui/input";
import { GIVEAWAYS, getGame } from "@/domain/mock-data";
import { freshnessFromFeed, showFixtureShelves } from "@/integrations/content/feed";
import { feedGateProps, useFreeOffersFeed } from "@/integrations/content/use-content-feed";
import {
  filterOffersByQueryAndDiscount,
  filterOwnedGiveaways,
  hasEnded,
  isEndingSoon,
} from "@/domain/deal";
import { countdownFrom } from "@/domain/release";
import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/i18n/I18nProvider";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { useSteam } from "@/integrations/steam/SteamProvider";
import { useGameTitle } from "@/components/gp/use-game-title";
import type { Deal, Giveaway } from "@/domain/types";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/free")({
  head: () => ({
    meta: [
      { title: "Free Games & Giveaways — Inga" },
      {
        name: "description",
        content:
          "Every game that is free to claim right now, with expiry countdowns you can trust.",
      },
      { property: "og:title", content: "Free Games & Giveaways — Inga" },
      { property: "og:description", content: "Games free to claim right now, with expiry times." },
    ],
    links: canonicalLinks("/free"),
  }),
  component: FreePage,
});

function money(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

function GiveawayCard({ giveaway }: { giveaway: Giveaway }) {
  const { t, locale } = useI18n();
  const now = useNow();
  const game = giveaway.game ?? getGame(giveaway.gameId);
  const summary = giveaway.gameSummary;
  const target = game ?? summary;
  const title = useGameTitle(game ?? { title: summary?.title ?? giveaway.store });
  if (!target) return null;

  const coverUrl = game?.coverUrl ?? summary?.coverUrl ?? "";
  const platforms = game?.platforms ?? [];
  const parts = now === null || !giveaway.endsAt ? null : countdownFrom(giveaway.endsAt, now);
  const expired = hasEnded(giveaway.endsAt, now);

  const cardCover = (
    <div className="relative h-36 overflow-hidden">
      <img
        src={coverUrl}
        alt=""
        loading="lazy"
        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
      />
      <div className="gp-cover-scrim absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />
      <span
        className={cn(
          "absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-bold",
          expired ? "bg-destructive text-destructive-foreground" : "bg-success text-background",
        )}
      >
        {expired ? t("free.expired") : t("free.badge")}
      </span>
    </div>
  );

  return (
    <article className={cn("gp-panel group relative overflow-hidden", expired && "opacity-80")}>
      {game?.slug ? (
        <Link to="/game/$slug" params={{ slug: game.slug }} className="block">
          {cardCover}
        </Link>
      ) : giveaway.url ? (
        <a href={giveaway.url} target="_blank" rel="noopener noreferrer" className="block">
          {cardCover}
        </a>
      ) : (
        cardCover
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {game?.slug ? (
              <Link to="/game/$slug" params={{ slug: game.slug }}>
                <h3 className="truncate font-semibold text-foreground transition-colors hover:text-accent">
                  {title}
                </h3>
              </Link>
            ) : giveaway.url ? (
              <a href={giveaway.url} target="_blank" rel="noopener noreferrer">
                <h3 className="truncate font-semibold text-foreground transition-colors hover:text-accent">
                  {title}
                </h3>
              </a>
            ) : (
              <h3 className="truncate font-semibold text-foreground">{title}</h3>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="truncate text-xs text-muted-foreground">{giveaway.store}</p>
              <SteamOwnershipBadge game={target} variant="compact" />
            </div>
          </div>
          <WishlistButton gameId={giveaway.gameId} />
        </div>
        {platforms.length > 0 && <PlatformBadgeList platforms={platforms} max={4} />}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Timer aria-hidden className="size-3.5" />
            {expired ? (
              t("free.expired")
            ) : (
              <>
                <span aria-hidden="true" className="font-mono tabular-nums text-foreground">
                  {parts
                    ? t("countdown.compact", {
                        days: parts.days,
                        hours: String(parts.hours).padStart(2, "0"),
                        minutes: String(parts.minutes).padStart(2, "0"),
                      })
                    : "--"}
                </span>
                <span className="sr-only">{giveaway.endsAt}</span>
              </>
            )}
          </span>
          {giveaway.worth !== undefined && !expired && (
            <span className="text-xs text-muted-foreground line-through">
              {money(giveaway.worth, giveaway.currency ?? "USD", locale)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function dealToGiveaway(deal: Deal): Giveaway {
  return {
    id: deal.id,
    gameId: deal.gameId,
    store: deal.store,
    endsAt: deal.endsAt ?? deal.claimEndsAt ?? "",
    ...(deal.priceBase !== undefined ? { worth: deal.priceBase } : {}),
    ...(deal.currency ? { currency: deal.currency } : {}),
    ...(deal.url ? { url: deal.url } : {}),
    ...(deal.offerType ? { offerType: deal.offerType } : {}),
    ...(deal.claimEndsAt ? { claimEndsAt: deal.claimEndsAt } : {}),
    ...(deal.accessEndsAt ? { accessEndsAt: deal.accessEndsAt } : {}),
    ...(deal.gameSummary ? { gameSummary: deal.gameSummary } : {}),
    ...(deal.game ? { game: deal.game } : {}),
  };
}

function FreePage() {
  const { t } = useI18n();
  const now = useNow();
  const freeFeed = useFreeOffersFeed();
  const { hideOwned, set: setPref } = usePreferences();
  const [searchQuery, setSearchQuery] = useState("");
  const { status: steamStatus, syncStatus: steamSyncStatus, getOwnership } = useSteam();
  const canFilterOwned =
    steamStatus === "connected" &&
    steamSyncStatus !== "unavailable" &&
    steamSyncStatus !== "failed";
  const effectiveHideOwned = hideOwned && canFilterOwned;

  const fixtures = showFixtureShelves(freeFeed.data?.source);
  const rawGiveaways: Giveaway[] = useMemo(() => {
    const feedItems = freeFeed.data?.items ?? [];
    if (feedItems.length > 0) {
      return feedItems.map(dealToGiveaway);
    }
    return fixtures ? GIVEAWAYS : [];
  }, [freeFeed.data?.items, fixtures]);

  const giveaways = useMemo(() => {
    const scoped = effectiveHideOwned
      ? filterOwnedGiveaways(rawGiveaways, (id) => getGame(id), getOwnership)
      : rawGiveaways;
    return filterOffersByQueryAndDiscount(scoped, searchQuery);
  }, [rawGiveaways, effectiveHideOwned, getOwnership, searchQuery]);

  const expiredList = giveaways.filter((g) => hasEnded(g.endsAt, now));
  const soon = giveaways.filter((g) => isEndingSoon(g.endsAt, now));
  const soonIds = new Set(soon.map((g) => g.id));
  const rest = giveaways.filter((g) => !hasEnded(g.endsAt, now) && !soonIds.has(g.id));
  const freshness = freshnessFromFeed(
    freeFeed.data,
    freeFeed.isPending,
    Date.now(),
    freeFeed.isError,
  );

  return (
    <PageShell
      title={t("page.free.title")}
      description={t("page.free.subtitle")}
      freshness={freshness}
      toolbar={
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative w-full sm:w-48">
            <Search
              aria-hidden
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search giveaways..."
              className="h-8 pl-8 text-xs bg-background/50"
            />
          </div>
          <FilterChip
            active={effectiveHideOwned}
            disabled={!canFilterOwned}
            onClick={() => {
              if (canFilterOwned) {
                setPref("hideOwned", !hideOwned);
              }
            }}
            title={!canFilterOwned ? t("steam.signInFirst") : undefined}
            aria-label={t("filter.hideOwned")}
          >
            {t("filter.hideOwned")}
          </FilterChip>
          {freeFeed.isPending ? null : (
            <span className="ml-auto text-xs text-muted-foreground">
              {t("deals.count", { count: giveaways.length })}
            </span>
          )}
        </div>
      }
    >
      <FeedGate {...feedGateProps(freeFeed)}>
        {giveaways.length === 0 ? (
          <EmptyState
            title={t("feed.empty.title")}
            body={t("feed.empty.body")}
            icon={<Gift aria-hidden className="size-5" />}
          />
        ) : (
          <div className="space-y-8">
            {soon.length > 0 && (
              <section className="space-y-3">
                <SectionHeader title={t("free.endingSoon")} />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {soon.map((g) => (
                    <GiveawayCard key={g.id} giveaway={g} />
                  ))}
                </div>
              </section>
            )}
            {rest.length > 0 && (
              <section className="space-y-3">
                <SectionHeader title={t("free.claimable")} />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {rest.map((g) => (
                    <GiveawayCard key={g.id} giveaway={g} />
                  ))}
                </div>
              </section>
            )}
            {expiredList.length > 0 && (
              <section className="space-y-3">
                <SectionHeader title={t("free.expired")} />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {expiredList.map((g) => (
                    <GiveawayCard key={g.id} giveaway={g} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </FeedGate>
    </PageShell>
  );
}
