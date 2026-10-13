import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLinks } from "@/domain/seo";
import { Bell, Star } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { Segmented } from "@/components/gp/FilterChip";
import { CountdownChip } from "@/components/gp/CountdownCard";
import { GameCardCompact } from "@/components/gp/GameCard";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { EmptyState } from "@/components/gp/EmptyState";
import { FeedGate } from "@/components/gp/FeedGate";
import { freshnessFromFeed, splitReleaseItems } from "@/integrations/content/feed";
import { feedGateProps, useReleasesFeed } from "@/integrations/content/use-content-feed";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/library/LibraryProvider";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { displayTitle } from "@/domain/title";
import { watchlistCalendarIcs, canExportCalendar } from "@/domain/calendar";
import { calendarFeedEvents } from "@/domain/calendar-feed";
import { useNow } from "@/hooks/use-now";
import { isReleaseStillAhead } from "@/domain/release";
import { useFormatReleaseDate } from "@/components/gp/use-format-release";
import { useDealAlerts } from "@/deals/deal-alerts";
import { DealCard } from "@/components/gp/DealCard";

type TabId = "all" | "wishlist" | "following";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist & Alerts — Inga" },
      {
        name: "description",
        content:
          "The games you wishlisted or follow, with countdowns and delay alerts in one list.",
      },
      { property: "og:title", content: "Watchlist & Alerts — Inga" },
      {
        property: "og:description",
        content: "Your wishlisted and followed games with countdowns.",
      },
    ],
    links: canonicalLinks("/watchlist"),
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const { t, locale } = useI18n();
  const { wishlist, following } = useLibrary();
  const { titleLanguage } = usePreferences();
  const expiredDeals = useDealAlerts();
  const releasesFeed = useReleasesFeed();
  const now = useNow();
  const formatWhen = useFormatReleaseDate();
  const { upcoming, recent } = splitReleaseItems(releasesFeed.data?.items ?? [], now);
  const [tab, setTab] = useState<TabId>("all");
  const [fullOnly, setFullOnly] = useState(false);

  const ids =
    tab === "wishlist" ? wishlist : tab === "following" ? following : [...wishlist, ...following];
  const idSet = new Set(ids);

  const tracked = upcoming.filter(({ game }) => idSet.has(game.id));
  const released = recent.filter(({ game }) => idSet.has(game.id));
  const passed =
    now === null
      ? []
      : (releasesFeed.data?.items ?? []).filter(
          ({ game, event }) =>
            idSet.has(game.id) && event.state !== "available" && !isReleaseStillAhead(event, now),
        );

  return (
    <PageShell
      title={t("page.watchlist.title")}
      description={t("page.watchlist.subtitle")}
      freshness={freshnessFromFeed(
        releasesFeed.data,
        releasesFeed.isPending,
        Date.now(),
        releasesFeed.isError,
      )}
      toolbar={
        <>
          <Segmented<TabId>
            label={t("page.watchlist.title")}
            value={tab}
            onChange={setTab}
            options={[
              { id: "all", label: t("watchlist.tab.all"), Icon: Bell },
              { id: "wishlist", label: t("watchlist.tab.wishlist"), Icon: Star },
              { id: "following", label: t("watchlist.tab.following") },
            ]}
          />
          {tracked.some(({ event }) => canExportCalendar(event)) ? (
            <>
              <button
                type="button"
                aria-pressed={fullOnly}
                onClick={() => setFullOnly((value) => !value)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-accent hover:text-accent"
              >
                {t("calendar.fullOnly")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const rows = calendarFeedEvents(
                    tracked.map(({ game, event }) => ({
                      event,
                      title: displayTitle(game, titleLanguage),
                    })),
                    { fullOnly },
                  );
                  const ics = watchlistCalendarIcs(rows);
                  const blob = new Blob([ics], { type: "text/calendar" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "inga-watchlist.ics";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-accent hover:text-accent"
              >
                {t("watchlist.calendar")}
              </button>
            </>
          ) : null}
          {releasesFeed.isPending && !releasesFeed.data ? null : (
            <span className="ml-auto text-xs text-muted-foreground">
              {t("discover.results", { count: tracked.length + released.length + passed.length })}
            </span>
          )}
        </>
      }
    >
      <div className="space-y-8">
        {expiredDeals.length > 0 && (
          <section className="space-y-3">
            <SectionHeader title={t("deals.expired")} />
            <ul className="gp-panel divide-y divide-border p-2">
              {expiredDeals.map(({ deal, expiredAt }) => (
                <li key={deal.id} className="py-1">
                  <DealCard deal={deal} locale={locale} />
                  <p className="px-2 pb-1 text-xs text-muted-foreground">
                    {t("deals.expiredAt", {
                      date: new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(expiredAt)),
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <FeedGate {...feedGateProps(releasesFeed)}>
          {tracked.length === 0 && released.length === 0 && passed.length === 0 ? (
            expiredDeals.length > 0 ? null : (
              <EmptyState
                title={t("watchlist.empty.title")}
                body={t("watchlist.empty.body")}
                icon={<Star aria-hidden className="size-5" />}
                action={
                  <Link
                    to="/releases"
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"
                  >
                    {t("watchlist.browse")}
                  </Link>
                }
              />
            )
          ) : (
            <div className="space-y-8">
              {tracked.length > 0 && (
                <section className="space-y-3">
                  <SectionHeader title={t("watchlist.tab.all")} />
                  <div className="gp-panel grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {tracked.map(({ game, event }) => (
                      <CountdownChip key={event.id} game={game} event={event} />
                    ))}
                  </div>
                </section>
              )}

              {passed.length > 0 && (
                <section className="space-y-3">
                  <SectionHeader
                    title={t("watchlist.passed")}
                    description={t("watchlist.passed.note")}
                  />
                  <ul className="gp-panel divide-y divide-border p-4">
                    {passed.map(({ game, event }) => (
                      <li key={event.id}>
                        <Link
                          to="/game/$slug"
                          params={{ slug: game.slug }}
                          className="flex items-center justify-between gap-3 py-2 text-sm"
                        >
                          <span className="truncate font-medium text-foreground">
                            {displayTitle(game, titleLanguage)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatWhen(event.date, event.precision)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {released.length > 0 && (
                <section className="space-y-3">
                  <SectionHeader title={t("watchlist.released")} />
                  <div className="gp-panel space-y-1 p-4">
                    {released.map(({ game }) => (
                      <GameCardCompact key={game.id} game={game} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </FeedGate>
      </div>
    </PageShell>
  );
}
