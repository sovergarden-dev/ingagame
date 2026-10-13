import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock3, Newspaper, TrendingUp } from "lucide-react";
import { GIVEAWAYS, TRENDING, getGame } from "@/domain/mock-data";
import { isDefaultRadarEvent } from "@/domain/editions";
import { radarWinners } from "@/domain/conflicts";
import { httpUrl } from "@/domain/http-url";
import { gameFromHomeSnapshot, type HomeSnapshot } from "@/pwa/home-snapshot";
import { readHomeSnapshot, writeHomeSnapshot } from "@/pwa/home-snapshot-store";
import { CountdownChip, CountdownHero } from "@/components/gp/CountdownCard";
import { useFormatReleaseDate } from "@/components/gp/use-format-release";
import { canonicalLinks } from "@/domain/seo";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { displayTitle } from "@/domain/title";
import { ReleaseRadar } from "@/components/gp/ReleaseRadar";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { GameCard, GameCardCompact } from "@/components/gp/GameCard";
import { DealCard } from "@/components/gp/DealCard";
import { FreshnessStatus } from "@/components/gp/FreshnessStatus";
import { EmptyState } from "@/components/gp/EmptyState";
import { FeedGate } from "@/components/gp/FeedGate";
import { PanelSkeleton } from "@/components/gp/Skeletons";
import {
  freshnessFromFeed,
  radarReferenceIso,
  showFixtureShelves,
  splitReleaseItems,
  uniqueGamesFromReleases,
} from "@/integrations/content/feed";
import { primaryRelease } from "@/domain/calendar";
import { isCountdownable, isReleaseStillAhead } from "@/domain/release";
import { pinnedGames } from "@/domain/pins";
import { usePins } from "@/pins/PinsProvider";
import {
  feedGateProps,
  useDealsFeed,
  useNewsFeed,
  useReleasesFeed,
} from "@/integrations/content/use-content-feed";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/library/LibraryProvider";
import { hasEnded, liveDeals } from "@/domain/deal";
import { useNow } from "@/hooks/use-now";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inga — Release Radar for every platform" },
      {
        name: "description",
        content:
          "Track game releases, countdowns, delays, deals and giveaways across PC, PlayStation, Xbox, Switch, mobile and VR in one command center.",
      },
      { property: "og:title", content: "Inga — Release Radar for every platform" },
      {
        property: "og:description",
        content:
          "Know earlier, plan smarter, play first. Release countdowns, delay radar and deals in one place.",
      },
    ],
    links: canonicalLinks("/"),
  }),
  component: Home,
});

function Home() {
  const { t, locale } = useI18n();
  const { titleLanguage } = usePreferences();
  const pins = usePins();
  const formatWhen = useFormatReleaseDate();
  const [lastVisit, setLastVisit] = useState<HomeSnapshot | null>(null);

  useEffect(() => {
    let cancel = false;
    void readHomeSnapshot().then((snapshot) => {
      if (!cancel) setLastVisit(snapshot);
    });
    return () => {
      cancel = true;
    };
  }, []);
  const { wishlist, following } = useLibrary();
  const now = useNow();
  const releasesFeed = useReleasesFeed();
  const dealsFeed = useDealsFeed();
  const newsFeed = useNewsFeed();
  const { upcoming, recent, changed } = splitReleaseItems(releasesFeed.data?.items ?? [], now);
  const playable = radarWinners(upcoming.filter((entry) => isDefaultRadarEvent(entry.event)));
  const deals = liveDeals(dealsFeed.data?.items ?? [], now);
  const articles = newsFeed.data?.items ?? [];
  const featured = playable[0];

  useEffect(() => {
    if (!featured) return;
    const snapshot: HomeSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      slug: featured.game.slug,
      title: featured.game.title,
      ...(featured.game.originalTitle ? { originalTitle: featured.game.originalTitle } : {}),
      summary: featured.game.summary,
      coverUrl: featured.game.backdropUrl ?? featured.game.coverUrl,
      developer: featured.game.developer,
      publisher: featured.game.publisher,
      platforms: featured.game.platforms,
      event: featured.event,
    };
    void writeHomeSnapshot(snapshot);
  }, [featured]);
  const radarClock = radarReferenceIso(now);
  const releaseGate = feedGateProps(releasesFeed);
  const dealsGate = feedGateProps(dealsFeed);
  const newsGate = feedGateProps(newsFeed);

  const myNext = playable.filter((e) => wishlist.includes(e.game.id)).slice(0, 4);
  const pinned = pinnedGames(
    pins.ids,
    uniqueGamesFromReleases(releasesFeed.data?.items ?? []),
  ).flatMap((game) => {
    const event = primaryRelease(game.releaseEvents);
    if (!event || !isCountdownable(event)) return [];
    if (now !== null && !isReleaseStillAhead(event, now)) return [];
    return [{ game, event }];
  });
  const fixtures = showFixtureShelves(releasesFeed.data?.source);
  const liveGiveaways = fixtures ? GIVEAWAYS.filter((g) => !hasEnded(g.endsAt, now)) : [];
  const freshness = freshnessFromFeed(
    releasesFeed.data,
    releasesFeed.isPending,
    Date.now(),
    releasesFeed.isError,
  );

  return (
    <div className="w-full min-w-0 space-y-[var(--density-section,2.25rem)] overflow-x-clip">
      <div className="flex items-center justify-between gap-3">
        <p className="gp-eyebrow">{t("app.tagline")}</p>
        <FreshnessStatus status={freshness} />
      </div>

      {releasesFeed.isPending && !featured && lastVisit ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{t("home.lastVisit")}</p>
          <CountdownHero
            game={gameFromHomeSnapshot(lastVisit)}
            event={lastVisit.event}
            backdropUrl={lastVisit.coverUrl}
          />
        </div>
      ) : releasesFeed.isPending && !featured ? (
        <PanelSkeleton rows={4} />
      ) : featured ? (
        <CountdownHero
          game={featured.game}
          event={featured.event}
          backdropUrl={featured.game.backdropUrl ?? featured.game.coverUrl}
        />
      ) : null}

      <FeedGate {...releaseGate}>
        <ReleaseRadar entries={playable} referenceDate={radarClock} />
      </FeedGate>

      {pinned.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title={t("home.pinned")} />
          <div className="grid gap-2 sm:grid-cols-2">
            {pinned.map(({ game, event }) => (
              <CountdownChip key={game.id} game={game} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* My next releases */}
        <section className="gp-panel p-4 sm:p-5">
          <SectionHeader
            title={t("section.myNextReleases")}
            viewAllTo="/watchlist"
            viewAllLabel={t("action.viewAll")}
          />
          <FeedGate {...releaseGate} showStaleBanner={false}>
            <div className="mt-3 space-y-1">
              {myNext.length ? (
                myNext.map(({ game, event }) => (
                  <CountdownChip key={event.id} game={game} event={event} />
                ))
              ) : (
                <EmptyState
                  title={
                    wishlist.length + following.length > 0
                      ? t("home.nextTrackedEmpty")
                      : t("empty.title")
                  }
                  body={
                    wishlist.length + following.length > 0
                      ? t("home.nextTrackedEmpty.body")
                      : t("empty.body")
                  }
                  className="border-none shadow-none"
                />
              )}
            </div>
          </FeedGate>
        </section>

        {/* Delay radar */}
        <section className="gp-panel p-4 sm:p-5">
          <SectionHeader title={t("section.changes")} />
          <FeedGate {...releaseGate} showStaleBanner={false}>
            {changed.length ? (
              <ul className="mt-3 space-y-1">
                {changed.map(({ game, event }) => (
                  <li key={event.id}>
                    <Link
                      to="/game/$slug"
                      params={{ slug: game.slug }}
                      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-2/70"
                    >
                      <Clock3 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {displayTitle(game, titleLanguage)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatWhen(event.date, event.precision)}
                        </span>
                      </span>
                      <span
                        className={
                          (event.delayDays ?? 0) > 0
                            ? "shrink-0 rounded-md bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                            : "shrink-0 rounded-md bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-success"
                        }
                      >
                        {t("countdown.shift", {
                          n:
                            (event.delayDays ?? 0) > 0
                              ? `+${event.delayDays}`
                              : String(event.delayDays ?? 0),
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={t("empty.title")}
                body={t("empty.body")}
                className="mt-3 border-none shadow-none"
              />
            )}
          </FeedGate>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Free right now */}
        <section className="gp-panel p-4 sm:p-5">
          <SectionHeader
            title={t("section.freeNow")}
            viewAllTo="/free"
            viewAllLabel={t("action.viewAll")}
          />
          <div className="mt-3 space-y-1">
            {releasesFeed.isPending && !releasesFeed.data ? (
              <PanelSkeleton />
            ) : liveGiveaways.length ? (
              liveGiveaways.map((g) => {
                const game = getGame(g.gameId);
                if (!game) return null;
                return (
                  <GameCardCompact
                    key={g.id}
                    game={game}
                    trailing={
                      <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                        {g.store}
                      </span>
                    }
                  />
                );
              })
            ) : (
              <EmptyState
                title={fixtures ? t("empty.title") : t("feed.empty.title")}
                body={fixtures ? t("empty.body") : t("feed.empty.body")}
                className="border-none shadow-none"
              />
            )}
          </div>
        </section>

        {/* Biggest deals */}
        <section className="gp-panel p-4 sm:p-5">
          <SectionHeader
            title={t("section.deals")}
            viewAllTo="/deals"
            viewAllLabel={t("action.viewAll")}
          />
          <FeedGate {...dealsGate}>
            {deals.length ? (
              <div className="mt-3 space-y-3">
                {deals[0] ? <DealCard deal={deals[0]} locale={locale} featured /> : null}
                <div className="space-y-1">
                  {deals.slice(1).map((deal) => (
                    <DealCard key={deal.id} deal={deal} locale={locale} />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title={t("empty.title")}
                body={t("empty.body")}
                className="border-none shadow-none"
              />
            )}
          </FeedGate>
        </section>
      </div>

      {/* Trending */}
      {fixtures ? (
        <section>
          <SectionHeader
            eyebrow={t("app.name")}
            title={t("section.trending")}
            viewAllTo="/discover"
            viewAllLabel={t("action.viewAll")}
            actions={<TrendingUp aria-hidden className="size-4 text-accent" />}
          />
          <div className="gp-scroll-x -mx-1 mt-3 flex gap-3 px-1 pb-2">
            {TRENDING.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Recently released */}
      <section>
        <SectionHeader
          title={t("section.recent")}
          viewAllTo="/releases"
          viewAllLabel={t("action.viewAll")}
        />
        <FeedGate {...releaseGate} showStaleBanner={false}>
          {recent.length ? (
            <div className="gp-scroll-x -mx-1 mt-3 flex gap-3 px-1 pb-2">
              {recent.map(({ game }) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("empty.title")}
              body={t("empty.body")}
              className="mt-3 border-none shadow-none"
            />
          )}
        </FeedGate>
      </section>

      {/* News */}
      <section className="gp-panel p-4 sm:p-5">
        <SectionHeader
          title={t("section.news")}
          viewAllTo="/news"
          viewAllLabel={t("action.viewAll")}
          actions={<Newspaper aria-hidden className="size-4 text-muted-foreground" />}
        />
        <FeedGate {...newsGate}>
          <ul className="mt-3 divide-y divide-border">
            {articles.map((article) => {
              const game = article.game;
              const external = httpUrl(article.url);
              const title = (
                <p className="text-sm font-medium leading-snug text-foreground group-hover:text-accent">
                  {article.title}
                </p>
              );
              return (
                <li key={article.id} className="group flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    {game ? (
                      <Link to="/game/$slug" params={{ slug: game.slug }}>
                        {title}
                      </Link>
                    ) : external ? (
                      <a href={external} target="_blank" rel="noreferrer">
                        {title}
                      </a>
                    ) : (
                      title
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {article.source} ·{" "}
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(article.publishedAt))}
                    </p>
                  </div>
                  {game || external ? (
                    <ArrowUpRight
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </FeedGate>
      </section>
    </div>
  );
}
