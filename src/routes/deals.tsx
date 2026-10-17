import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Percent, Tag, Timer } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { FilterChip, Segmented } from "@/components/gp/FilterChip";
import { DealCard } from "@/components/gp/DealCard";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { EmptyState } from "@/components/gp/EmptyState";
import { FeedGate } from "@/components/gp/FeedGate";
import { freshnessFromFeed } from "@/integrations/content/feed";
import { feedGateProps, useDealsFeed } from "@/integrations/content/use-content-feed";
import { dealsForPlatforms, filterOwnedDeals, isDealExpired, liveDeals } from "@/domain/deal";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { useSteam } from "@/integrations/steam/SteamProvider";
import { countdownFrom } from "@/domain/release";
import { useNow } from "@/hooks/use-now";
import { canonicalLinks } from "@/domain/seo";
import { useI18n } from "@/i18n/I18nProvider";
import type { Deal } from "@/domain/types";

type SortId = "discount" | "price" | "ending";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals — Inga" },
      {
        name: "description",
        content:
          "Track the biggest game discounts across stores, sorted by discount, price or expiry.",
      },
      { property: "og:title", content: "Deals — Inga" },
      { property: "og:description", content: "The biggest game discounts across stores." },
    ],
    links: canonicalLinks("/deals"),
  }),
  component: DealsPage,
});

function EndsIn({ endsAt }: { endsAt?: string }) {
  const { t } = useI18n();
  const now = useNow();
  if (!endsAt) return <span className="text-xs text-muted-foreground">{t("deals.noEnd")}</span>;
  const ended = isDealExpired(endsAt, now);
  if (ended)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
        <Timer aria-hidden className="size-3.5" />
        {t("deals.alert.title")}
      </span>
    );
  const parts = now === null ? null : countdownFrom(endsAt, now);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Timer aria-hidden className="size-3.5" />
      {t("deals.endsIn")}{" "}
      <span aria-hidden="true" className="font-mono tabular-nums text-foreground">
        {parts
          ? t("countdown.compactShort", {
              days: parts.days,
              hours: String(parts.hours).padStart(2, "0"),
            })
          : "--"}
      </span>
      <span className="sr-only">{endsAt}</span>
    </span>
  );
}

function sortDeals(deals: Deal[], sort: SortId, now: number | null) {
  const copy = [...deals];
  if (sort === "discount") copy.sort((a, b) => b.discountPercent - a.discountPercent);
  else if (sort === "price") copy.sort((a, b) => a.priceCurrent - b.priceCurrent);
  else {
    copy.sort((a, b) => {
      const av = a.endsAt ? Date.parse(a.endsAt) : Number.POSITIVE_INFINITY;
      const bv = b.endsAt ? Date.parse(b.endsAt) : Number.POSITIVE_INFINITY;
      return av - bv;
    });
  }
  const live = liveDeals(copy, now);
  if (now === null) return copy;
  const liveIds = new Set(live.map((deal) => deal.id));
  return [
    ...copy.filter((deal) => liveIds.has(deal.id)),
    ...copy.filter((deal) => !liveIds.has(deal.id)),
  ];
}

function DealsPage() {
  const { t, locale } = useI18n();
  const now = useNow();
  const feed = useDealsFeed();
  const deals = useMemo(() => feed.data?.items ?? [], [feed.data?.items]);
  const [sort, setSort] = useState<SortId>("discount");
  const [stores, setStores] = useState<string[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const { myPlatforms, hideOwned, set: setPref } = usePreferences();
  const { status: steamStatus, syncStatus: steamSyncStatus, getOwnership } = useSteam();
  const canFilterOwned =
    steamStatus === "connected" &&
    steamSyncStatus !== "unavailable" &&
    steamSyncStatus !== "failed";
  const effectiveHideOwned = hideOwned && canFilterOwned;

  const allStores = useMemo(() => [...new Set(deals.map((d) => d.store))].sort(), [deals]);
  const filtered = useMemo(() => {
    const storeScoped = stores.length ? deals.filter((d) => stores.includes(d.store)) : deals;
    const scoped = mineOnly ? dealsForPlatforms(storeScoped, myPlatforms) : storeScoped;
    const ownershipScoped = effectiveHideOwned ? filterOwnedDeals(scoped, getOwnership) : scoped;
    return sortDeals(ownershipScoped, sort, now);
  }, [deals, sort, stores, now, mineOnly, myPlatforms, effectiveHideOwned, getOwnership]);
  const featured = filtered.slice(0, 3);
  const rest = filtered.slice(3);
  const freshness = freshnessFromFeed(feed.data, feed.isPending, Date.now(), feed.isError);

  return (
    <PageShell
      title={t("page.deals.title")}
      description={t("page.deals.subtitle")}
      freshness={freshness}
      toolbar={
        <>
          <Segmented<SortId>
            label={t("deals.all")}
            value={sort}
            onChange={setSort}
            options={[
              { id: "discount", label: t("deals.sort.discount"), Icon: Percent },
              { id: "price", label: t("deals.sort.price"), Icon: Tag },
              { id: "ending", label: t("deals.sort.ending"), Icon: Timer },
            ]}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="gp-eyebrow mr-1">{t("deals.store")}</span>
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
            <FilterChip active={mineOnly} onClick={() => setMineOnly((value) => !value)}>
              {t("filter.myPlatforms")}
            </FilterChip>
            {allStores.map((store) => (
              <FilterChip
                key={store}
                active={stores.includes(store)}
                onClick={() =>
                  setStores((prev) =>
                    prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store],
                  )
                }
              >
                {store}
              </FilterChip>
            ))}
          </div>
          {feed.isPending && !feed.data ? null : (
            <span className="ml-auto text-xs text-muted-foreground">
              {t("deals.count", { count: filtered.length })}
            </span>
          )}
        </>
      }
    >
      <FeedGate {...feedGateProps(feed)}>
        {featured.length ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <section className="space-y-3">
              <SectionHeader title={t("deals.featured")} />
              <div className="space-y-4">
                {featured.map((deal) => (
                  <div key={deal.id} className="space-y-2">
                    <DealCard deal={deal} locale={locale} featured />
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-muted-foreground">{deal.store}</span>
                      <EndsIn {...(deal.endsAt ? { endsAt: deal.endsAt } : {})} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <SectionHeader title={t("deals.all")} />
              <ul className="gp-panel divide-y divide-border p-2">
                {rest.map((deal) => (
                  <li key={deal.id} className="py-1">
                    <DealCard deal={deal} locale={locale} />
                    <div className="px-2 pb-1">
                      <EndsIn {...(deal.endsAt ? { endsAt: deal.endsAt } : {})} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <EmptyState
            title={t("common.noResults")}
            body={t("common.reset")}
            icon={<Tag aria-hidden className="size-5" />}
          />
        )}
      </FeedGate>
    </PageShell>
  );
}
