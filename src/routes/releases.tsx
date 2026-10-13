import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, LayoutGrid, ListOrdered, Radar, Rows3, Timer } from "lucide-react";
import { ReleaseRadar } from "@/components/gp/ReleaseRadar";
import { AgendaView, CountdownView, MonthView, TimelineView } from "@/components/gp/ReleaseViews";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { GameCard } from "@/components/gp/GameCard";
import { EmptyState } from "@/components/gp/EmptyState";
import { FeedGate } from "@/components/gp/FeedGate";
import { FreshnessStatus } from "@/components/gp/FreshnessStatus";
import {
  freshnessFromFeed,
  radarReferenceIso,
  splitReleaseItems,
} from "@/integrations/content/feed";
import { feedGateProps, useReleasesFeed } from "@/integrations/content/use-content-feed";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { useLibrary } from "@/library/LibraryProvider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DEFAULT_RADAR_KINDS } from "@/domain/editions";
import { radarWinners } from "@/domain/conflicts";
import type { ReleaseKind } from "@/domain/types";
import { useNow } from "@/hooks/use-now";
import { canonicalLinks } from "@/domain/seo";

const VIEWS = [
  { id: "rail", labelKey: "views.rail", Icon: Radar },
  { id: "timeline", labelKey: "views.timeline", Icon: Rows3 },
  { id: "agenda", labelKey: "views.agenda", Icon: ListOrdered },
  { id: "month", labelKey: "views.month", Icon: CalendarDays },
  { id: "countdown", labelKey: "views.countdown", Icon: Timer },
  { id: "recent", labelKey: "views.recent", Icon: LayoutGrid },
] as const;

const KINDS: ReleaseKind[] = ["full", "early-access", "dlc", "expansion", "demo", "beta"];

export const Route = createFileRoute("/releases")({
  head: () => ({
    meta: [
      { title: "Releases — Inga Release Radar" },
      {
        name: "description",
        content:
          "Every upcoming game release grouped by date, with platform filters, delay tracking and confidence states.",
      },
      { property: "og:title", content: "Releases — Inga Release Radar" },
      {
        property: "og:description",
        content: "Upcoming releases by date, with platform filters and delay tracking.",
      },
    ],
    links: canonicalLinks("/releases"),
  }),
  component: Releases,
});

function Releases() {
  const { t } = useI18n();
  const now = useNow();
  const { wishlist, following } = useLibrary();
  const feed = useReleasesFeed();
  const { upcoming, recent } = splitReleaseItems(feed.data?.items ?? [], now);
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("rail");
  const [kinds, setKinds] = useState<ReleaseKind[]>([...DEFAULT_RADAR_KINDS]);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [followedOnly, setFollowedOnly] = useState(false);

  const entries = radarWinners(
    upcoming.filter((e) => {
      if (kinds.length && !kinds.includes(e.event.kind)) return false;
      if (wishlistOnly && !wishlist.includes(e.game.id)) return false;
      if (followedOnly && !following.includes(e.game.id)) return false;
      return true;
    }),
  );
  const freshness = freshnessFromFeed(feed.data, feed.isPending, Date.now(), feed.isError);
  const radarClock = radarReferenceIso(now);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          eyebrow={t("app.tagline")}
          title={t("nav.releases")}
          description={t("radar.subtitle")}
          size="lg"
        />
        <FreshnessStatus status={freshness} />
      </div>

      <div className="gp-panel flex flex-wrap items-center gap-4 p-3">
        <div
          role="tablist"
          aria-label={t("views.group")}
          className="flex flex-wrap items-center gap-1"
        >
          {VIEWS.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
                view === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              {t(labelKey as MessageKey)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="gp-eyebrow mr-1">{t("filter.releaseType")}</span>
          {KINDS.map((kind) => {
            const active = kinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setKinds((prev) =>
                    prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
                  )
                }
                className={cn(
                  "h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {t(`kind.${kind}` as MessageKey)}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="wishlist-only" checked={wishlistOnly} onCheckedChange={setWishlistOnly} />
            <Label htmlFor="wishlist-only" className="text-xs text-muted-foreground">
              {t("filter.wishlistOnly")}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="followed-only" checked={followedOnly} onCheckedChange={setFollowedOnly} />
            <Label htmlFor="followed-only" className="text-xs text-muted-foreground">
              {t("filter.followedOnly")}
            </Label>
          </div>
        </div>
      </div>

      <FeedGate {...feedGateProps(feed)}>
        {view === "rail" && <ReleaseRadar entries={entries} referenceDate={radarClock} />}
        {view === "timeline" && <TimelineView entries={entries} />}
        {view === "agenda" && <AgendaView entries={entries} />}
        {view === "month" && <MonthView entries={entries} referenceDate={radarClock} />}
        {view === "countdown" && <CountdownView entries={entries} />}

        {view === "recent" && (
          <section>
            <SectionHeader title={t("views.recent")} />
            {recent.length ? (
              <div className="gp-scroll-x mt-3 flex gap-3 pb-2">
                {recent.map(({ game }) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            ) : (
              <EmptyState title={t("empty.title")} body={t("empty.body")} className="mt-3" />
            )}
          </section>
        )}
      </FeedGate>
    </div>
  );
}
