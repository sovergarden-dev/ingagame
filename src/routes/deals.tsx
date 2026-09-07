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
import { isDealExpired } from "@/domain/deal";
import { countdownFrom } from "@/domain/release";
import { useNow } from "@/hooks/use-now";
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
      <span className="font-mono tabular-nums text-foreground">
        {parts ? `${parts.days}d ${String(parts.hours).padStart(2, "0")}h` : "--"}
      </span>
    </span>
  );
}

function sortDeals(deals: Deal[], sort: SortId) {
  const copy = [...deals];
  if (sort === "discount") return copy.sort((a, b) => b.discountPercent - a.discountPercent);
  if (sort === "price") return copy.sort((a, b) => a.priceCurrent - b.priceCurrent);
  return copy.sort((a, b) => {
    const av = a.endsAt ? Date.parse(a.endsAt) : Number.POSITIVE_INFINITY;
    const bv = b.endsAt ? Date.parse(b.endsAt) : Number.POSITIVE_INFINITY;
    return av - bv;
  });
}

function DealsPage() {
  const { t, locale } = useI18n();
  const feed = useDealsFeed();
  const deals = useMemo(() => feed.data?.items ?? [], [feed.data?.items]);
  const [sort, setSort] = useState<SortId>("discount");
  const [stores, setStores] = useState<string[]>([]);

  const allStores = useMemo(() => [...new Set(deals.map((d) => d.store))].sort(), [deals]);
  const filtered = useMemo(
    () => sortDeals(stores.length ? deals.filter((d) => stores.includes(d.store)) : deals, sort),
    [deals, sort, stores],
  );
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
          <span className="ml-auto text-xs text-muted-foreground">
            {t("deals.count", { count: filtered.length })}
          </span>
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
