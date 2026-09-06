import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Star } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { Segmented } from "@/components/gp/FilterChip";
import { CountdownChip } from "@/components/gp/CountdownCard";
import { GameCardCompact } from "@/components/gp/GameCard";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { EmptyState } from "@/components/gp/EmptyState";
import { RECENTLY_RELEASED, UPCOMING_RELEASES } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/library/LibraryProvider";
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
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const { t, locale } = useI18n();
  const { wishlist, following } = useLibrary();
  const expiredDeals = useDealAlerts();
  const [tab, setTab] = useState<TabId>("all");

  const ids =
    tab === "wishlist" ? wishlist : tab === "following" ? following : [...wishlist, ...following];
  const idSet = new Set(ids);

  const tracked = UPCOMING_RELEASES.filter(({ game }) => idSet.has(game.id));
  const released = RECENTLY_RELEASED.filter(({ game }) => idSet.has(game.id));

  return (
    <PageShell
      title={t("page.watchlist.title")}
      description={t("page.watchlist.subtitle")}
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
          <span className="ml-auto text-xs text-muted-foreground">
            {t("discover.results", { count: tracked.length + released.length })}
          </span>
        </>
      }
    >
      {tracked.length === 0 && released.length === 0 && expiredDeals.length === 0 ? (
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
    </PageShell>
  );
}
