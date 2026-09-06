import { createFileRoute } from "@tanstack/react-router";
import { Gift, Timer } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { EmptyState } from "@/components/gp/EmptyState";
import { PlatformBadgeList } from "@/components/gp/PlatformBadge";
import { WishlistButton } from "@/components/gp/WishlistButton";
import { GIVEAWAYS, getGame } from "@/domain/mock-data";
import { hasEnded, isEndingSoon } from "@/domain/deal";
import { countdownFrom } from "@/domain/release";
import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/i18n/I18nProvider";
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
            {expired ? t("free.expired") : "FREE"}
          </span>
        </div>
      </Link>
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to="/game/$slug" params={{ slug: game.slug }}>
              <h3 className="truncate font-semibold text-foreground transition-colors hover:text-accent">
                {game.title}
              </h3>
            </Link>
            <p className="truncate text-xs text-muted-foreground">{giveaway.store}</p>
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
              <span className="font-mono tabular-nums text-foreground">
                {parts
                  ? `${parts.days}d ${String(parts.hours).padStart(2, "0")}h ${String(parts.minutes).padStart(2, "0")}m`
                  : "--"}
              </span>
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

  const expiredList = GIVEAWAYS.filter((g) => hasEnded(g.endsAt, now));
  const soon = GIVEAWAYS.filter((g) => isEndingSoon(g.endsAt, now));
  const soonIds = new Set(soon.map((g) => g.id));
  const rest = GIVEAWAYS.filter((g) => !hasEnded(g.endsAt, now) && !soonIds.has(g.id));

  return (
    <PageShell
      title={t("page.free.title")}
      description={t("page.free.subtitle")}
      freshness={{ state: "fresh", minutesAgo: 2 }}
    >
      {GIVEAWAYS.length === 0 ? (
        <EmptyState title={t("common.noResults")} icon={<Gift aria-hidden className="size-5" />} />
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
