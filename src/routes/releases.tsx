import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, LayoutGrid, ListOrdered, Radar, Rows3, Timer } from "lucide-react";
import { ReleaseRadar } from "@/components/gp/ReleaseRadar";
import {
  AgendaView,
  CountdownView,
  MonthView,
  TimelineView,
} from "@/components/gp/ReleaseViews";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { GameCard } from "@/components/gp/GameCard";
import { EmptyState } from "@/components/gp/EmptyState";
import { FreshnessStatus } from "@/components/gp/FreshnessStatus";
import { RECENTLY_RELEASED, UPCOMING_RELEASES } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import { useLibrary } from "@/library/LibraryProvider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ReleaseKind } from "@/domain/types";

const REFERENCE_DATE = "2026-09-03T00:00:00Z";

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
      { title: "Releases — GamePulse Release Radar" },
      {
        name: "description",
        content:
          "Every upcoming game release grouped by date, with platform filters, delay tracking and confidence states.",
      },
      { property: "og:title", content: "Releases — GamePulse Release Radar" },
      {
        property: "og:description",
        content: "Upcoming releases by date, with platform filters and delay tracking.",
      },
    ],
  }),
  component: Releases,
});

function Releases() {
  const { t } = useI18n();
  const { wishlist, following } = useLibrary();
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("rail");
  const [kinds, setKinds] = useState<ReleaseKind[]>([]);
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [followedOnly, setFollowedOnly] = useState(false);

  const entries = UPCOMING_RELEASES.filter((e) => {
    if (kinds.length && !kinds.includes(e.event.kind)) return false;
    if (wishlistOnly && !wishlist.includes(e.game.id)) return false;
    if (followedOnly && !following.includes(e.game.id)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          eyebrow={t("app.tagline")}
          title={t("nav.releases")}
          description={t("radar.subtitle")}
          size="lg"
        />
        <FreshnessStatus status={{ state: "stale", minutesAgo: 12 }} />
      </div>

      <div className="gp-panel flex flex-wrap items-center gap-4 p-3">
        <div role="tablist" aria-label="Views" className="flex flex-wrap items-center gap-1">
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

      {view === "rail" && <ReleaseRadar entries={entries} referenceDate={REFERENCE_DATE} />}
      {view === "timeline" && <TimelineView entries={entries} />}
      {view === "agenda" && <AgendaView entries={entries} />}
      {view === "month" && <MonthView entries={entries} referenceDate={REFERENCE_DATE} />}
      {view === "countdown" && <CountdownView entries={entries} />}

      {view === "recent" && (
        <section>
          <SectionHeader title={t("views.recent")} />
          <div className="gp-scroll-x mt-3 flex gap-3 pb-2">
            {RECENTLY_RELEASED.map(({ game }) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
