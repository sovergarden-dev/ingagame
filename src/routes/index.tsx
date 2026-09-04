import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Clock3, Newspaper, TrendingUp } from "lucide-react";
import {
  ARTICLES,
  CHANGED_RELEASES,
  DEALS,
  FEATURED_GAME,
  FEATURED_RELEASE,
  GIVEAWAYS,
  HERO_BACKDROP,
  RECENTLY_RELEASED,
  TRENDING,
  UPCOMING_RELEASES,
  getGame,
} from "@/domain/mock-data";
import { formatReleaseDate } from "@/domain/release";
import { CountdownChip, CountdownHero } from "@/components/gp/CountdownCard";
import { ReleaseRadar } from "@/components/gp/ReleaseRadar";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { GameCard, GameCardCompact } from "@/components/gp/GameCard";
import { DealCard } from "@/components/gp/DealCard";
import { FreshnessStatus } from "@/components/gp/FreshnessStatus";
import { GlobalLaunchWave } from "@/components/gp/GlobalLaunchWave";
import { EmptyState } from "@/components/gp/EmptyState";
import { LAUNCH_WAVE } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/library/LibraryProvider";

/** Stable reference "today" for the foundation pass. */
const REFERENCE_DATE = "2026-09-03T00:00:00Z";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GamePulse — Release Radar for every platform" },
      {
        name: "description",
        content:
          "Track game releases, countdowns, delays, deals and giveaways across PC, PlayStation, Xbox, Switch, mobile and VR in one command center.",
      },
      { property: "og:title", content: "GamePulse — Release Radar for every platform" },
      {
        property: "og:description",
        content:
          "Know earlier, plan smarter, play first. Release countdowns, delay radar and deals in one place.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { t, locale } = useI18n();
  const { wishlist } = useLibrary();

  const myNext = UPCOMING_RELEASES.filter((e) => wishlist.includes(e.game.id)).slice(0, 4);

  return (
    <div className="space-y-[var(--density-section,2.25rem)]">
      <div className="flex items-center justify-between gap-3">
        <p className="gp-eyebrow">{t("app.tagline")}</p>
        <FreshnessStatus status={{ state: "changed", minutesAgo: 43, changeCount: 3 }} />
      </div>

      <CountdownHero game={FEATURED_GAME} event={FEATURED_RELEASE} backdropUrl={HERO_BACKDROP} />

      <ReleaseRadar entries={UPCOMING_RELEASES} referenceDate={REFERENCE_DATE} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* My next releases */}
        <section className="gp-panel p-4 sm:p-5">
          <SectionHeader
            title={t("section.myNextReleases")}
            viewAllTo="/watchlist"
            viewAllLabel={t("action.viewAll")}
          />
          <div className="mt-3 space-y-1">
            {myNext.length ? (
              myNext.map(({ game, event }) => (
                <CountdownChip key={event.id} game={game} event={event} />
              ))
            ) : (
              <EmptyState
                title={t("empty.title")}
                body={t("empty.body")}
                className="border-none shadow-none"
              />
            )}
          </div>
        </section>

        {/* Delay radar */}
        <section className="gp-panel p-4 sm:p-5">
          <SectionHeader title={t("section.changes")} />
          <ul className="mt-3 space-y-1">
            {CHANGED_RELEASES.map(({ game, event }) => (
              <li key={event.id}>
                <Link
                  to="/game/$slug"
                  params={{ slug: game.slug }}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-2/70"
                >
                  <Clock3 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {game.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatReleaseDate(event.date, event.precision, locale)}
                    </span>
                  </span>
                  <span
                    className={
                      (event.delayDays ?? 0) > 0
                        ? "shrink-0 rounded-md bg-destructive/15 px-1.5 py-0.5 text-xs font-semibold text-destructive"
                        : "shrink-0 rounded-md bg-success/15 px-1.5 py-0.5 text-xs font-semibold text-success"
                    }
                  >
                    {(event.delayDays ?? 0) > 0 ? `+${event.delayDays}d` : `${event.delayDays}d`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <GlobalLaunchWave regions={LAUNCH_WAVE} />
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
            {GIVEAWAYS.map((g) => {
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
            })}
          </div>
        </section>

        {/* Biggest deals */}
        <section className="gp-panel p-4 sm:p-5">
          <SectionHeader
            title={t("section.deals")}
            viewAllTo="/deals"
            viewAllLabel={t("action.viewAll")}
          />
          <div className="mt-3 space-y-3">
            <DealCard deal={DEALS[0]!} locale={locale} featured />
            <div className="space-y-1">
              {DEALS.slice(1).map((deal) => (
                <DealCard key={deal.id} deal={deal} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Trending */}
      <section>
        <SectionHeader
          eyebrow={t("app.name")}
          title={t("section.trending")}
          viewAllTo="/discover"
          viewAllLabel={t("action.viewAll")}
          actions={<TrendingUp aria-hidden className="size-4 text-accent" />}
        />
        <div className="gp-scroll-x mt-3 flex gap-3 pb-2">
          {TRENDING.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      {/* Recently released */}
      <section>
        <SectionHeader
          title={t("section.recent")}
          viewAllTo="/releases"
          viewAllLabel={t("action.viewAll")}
        />
        <div className="gp-scroll-x mt-3 flex gap-3 pb-2">
          {RECENTLY_RELEASED.map(({ game }) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      {/* News */}
      <section className="gp-panel p-4 sm:p-5">
        <SectionHeader
          title={t("section.news")}
          viewAllTo="/news"
          viewAllLabel={t("action.viewAll")}
          actions={<Newspaper aria-hidden className="size-4 text-muted-foreground" />}
        />
        <ul className="mt-3 divide-y divide-border">
          {ARTICLES.map((article) => (
            <li key={article.id} className="group flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-foreground group-hover:text-accent">
                  {article.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {article.source} ·{" "}
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
                    new Date(article.publishedAt),
                  )}
                </p>
              </div>
              <ArrowUpRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
