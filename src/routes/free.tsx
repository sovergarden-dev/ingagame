import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { canonicalLinks } from "@/domain/seo";
import { Gift, Timer } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { FilterChip } from "@/components/gp/FilterChip";
import { SteamOwnershipBadge } from "@/components/gp/SteamOwnershipBadge";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { EmptyState } from "@/components/gp/EmptyState";
import { PanelSkeleton } from "@/components/gp/Skeletons";
import { PlatformBadgeList } from "@/components/gp/PlatformBadge";
import { WishlistButton } from "@/components/gp/WishlistButton";
import { GIVEAWAYS, getGame } from "@/domain/mock-data";
import { freshnessFromFeed, showFixtureShelves } from "@/integrations/content/feed";
import { useReleasesFeed } from "@/integrations/content/use-content-feed";
import { filterOwnedGiveaways, hasEnded, isEndingSoon } from "@/domain/deal";
import { countdownFrom } from "@/domain/release";
import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/i18n/I18nProvider";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { useSteam } from "@/integrations/steam/SteamProvider";
import { useGameTitle } from "@/components/gp/use-game-title";
import type { Giveaway } from "@/domain/types";
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
  const game = getGame(giveaway.gameId);
  const title = useGameTitle(game ?? { title: "" });
  if (!game) return null;

  const parts = now === null ? null : countdownFrom(giveaway.endsAt, now);
  const expired = hasEnded(giveaway.endsAt, now);

  return (
    <article className={cn("gp-panel group relative overflow-hidden", expired && "opacity-80")}>
      <Link to="/game/$slug" params={{ slug: game.slug }} className="block">
        <div className="relative h-36 overflow-hidden">
          <img
            src={game.coverUrl}
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
      </Link>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to="/game/$slug" params={{ slug: game.slug }}>
              <h3 className="truncate font-semibold text-foreground transition-colors hover:text-accent">
                {title}
              </h3>
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="truncate text-xs text-muted-foreground">{giveaway.store}</p>
              <SteamOwnershipBadge game={game} variant="compact" />
            </div>
          </div>
          <WishlistButton gameId={game.id} />
        </div>
        <PlatformBadgeList platforms={game.platforms} max={4} />
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

function FreePage() {
  const { t } = useI18n();
  const now = useNow();
  const releasesFeed = useReleasesFeed();
  const { hideOwned, set: setPref } = usePreferences();
  const { status: steamStatus, syncStatus: steamSyncStatus, getOwnership } = useSteam();
  const canFilterOwned =
    steamStatus === "connected" &&
    steamSyncStatus !== "unavailable" &&
    steamSyncStatus !== "failed";
  const effectiveHideOwned = hideOwned && canFilterOwned;

  const fixtures = showFixtureShelves(releasesFeed.data?.source);
  const rawGiveaways = fixtures ? GIVEAWAYS : [];
  const giveaways = useMemo(() => {
    if (!effectiveHideOwned) return rawGiveaways;
    return filterOwnedGiveaways(rawGiveaways, getGame, getOwnership);
  }, [rawGiveaways, effectiveHideOwned, getOwnership]);

  const expiredList = giveaways.filter((g) => hasEnded(g.endsAt, now));
  const soon = giveaways.filter((g) => isEndingSoon(g.endsAt, now));
  const soonIds = new Set(soon.map((g) => g.id));
  const rest = giveaways.filter((g) => !hasEnded(g.endsAt, now) && !soonIds.has(g.id));
  const freshness = freshnessFromFeed(
    releasesFeed.data,
    releasesFeed.isPending,
    Date.now(),
    releasesFeed.isError,
  );

  const waiting = releasesFeed.isPending && !releasesFeed.data;

  return (
    <PageShell
      title={t("page.free.title")}
      description={t("page.free.subtitle")}
      freshness={freshness}
      toolbar={
        <div className="flex flex-wrap items-center gap-1.5">
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
          {waiting || !fixtures ? null : (
            <span className="ml-auto text-xs text-muted-foreground">
              {t("deals.count", { count: giveaways.length })}
            </span>
          )}
        </div>
      }
    >
      {waiting ? (
        <PanelSkeleton />
      ) : !fixtures ? (
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
    </PageShell>
  );
}
