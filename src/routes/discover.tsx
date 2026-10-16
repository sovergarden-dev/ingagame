import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Sparkles } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { FilterChip, Segmented } from "@/components/gp/FilterChip";
import { GameCard } from "@/components/gp/GameCard";
import { EmptyState } from "@/components/gp/EmptyState";
import { PanelSkeleton } from "@/components/gp/Skeletons";
import { discoverGames, sharesHiddenGenre, type DiscoverSort } from "@/domain/discover";
import { canonicalLinks } from "@/domain/seo";
import { uniqueGamesFromReleases, freshnessFromFeed } from "@/integrations/content/feed";
import { useReleasesFeed } from "@/integrations/content/use-content-feed";
import { useSteam } from "@/integrations/steam/SteamProvider";
import { shouldHideOwnedGame } from "@/domain/ownership";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import type { PlatformFamily } from "@/domain/types";
import { Input } from "@/components/ui/input";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { useHiddenGames } from "@/discover/HiddenGamesProvider";

type SortId = DiscoverSort;

const FAMILIES: PlatformFamily[] = ["pc", "playstation", "xbox", "nintendo", "mobile", "vr"];

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover Games — Inga" },
      {
        name: "description",
        content:
          "Browse games by genre, platform and hype, tuned to the platforms you actually own.",
      },
      { property: "og:title", content: "Discover Games — Inga" },
      { property: "og:description", content: "Browse games by genre, platform and hype." },
    ],
    links: canonicalLinks("/discover"),
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { t } = useI18n();
  const releasesFeed = useReleasesFeed();
  const catalogue = uniqueGamesFromReleases(releasesFeed.data?.items ?? []);
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [families, setFamilies] = useState<PlatformFamily[]>([]);
  const [sort, setSort] = useState<SortId>("hype");
  const [mineOnly, setMineOnly] = useState(false);
  const hidden = useHiddenGames();
  const { myPlatforms, hideOwned, set: setPref } = usePreferences();
  const { status: steamStatus, syncStatus: steamSyncStatus, getOwnership } = useSteam();

  const canFilterOwned =
    steamStatus === "connected" &&
    steamSyncStatus !== "unavailable" &&
    steamSyncStatus !== "failed";
  const effectiveHideOwned = hideOwned && canFilterOwned;

  const allGenres = useMemo(
    () => [...new Set(catalogue.flatMap((g) => g.genres))].sort().slice(0, 12),
    [catalogue],
  );

  const games = useMemo(() => {
    const base = discoverGames(catalogue, {
      query,
      genres,
      families,
      sort,
      hiddenIds: hidden.ids,
      hiddenGenres: hidden.genres,
      ...(mineOnly ? { myPlatformIds: myPlatforms } : {}),
    });
    if (!effectiveHideOwned) return base;
    return base.filter((g) => !shouldHideOwnedGame(g, effectiveHideOwned, getOwnership));
  }, [
    catalogue,
    query,
    genres,
    families,
    sort,
    hidden.ids,
    hidden.genres,
    mineOnly,
    myPlatforms,
    effectiveHideOwned,
    getOwnership,
  ]);

  return (
    <PageShell
      title={t("page.discover.title")}
      description={t("page.discover.subtitle")}
      freshness={freshnessFromFeed(
        releasesFeed.data,
        releasesFeed.isPending,
        Date.now(),
        releasesFeed.isError,
      )}
      toolbar={
        <>
          <div className="relative w-full sm:w-64">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("discover.search")}
              aria-label={t("discover.search")}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Segmented<SortId>
            label={t("page.discover.title")}
            value={sort}
            onChange={setSort}
            options={[
              { id: "hype", label: t("discover.sort.hype"), Icon: Sparkles },
              { id: "critic", label: t("discover.sort.critic") },
              { id: "soonest", label: t("discover.sort.soonest") },
              { id: "title", label: t("discover.sort.title") },
            ]}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="gp-eyebrow mr-1">{t("filter.platforms")}</span>
            <FilterChip active={mineOnly} onClick={() => setMineOnly((value) => !value)}>
              {t("filter.myPlatforms")}
            </FilterChip>
            <FilterChip
              active={effectiveHideOwned}
              disabled={!canFilterOwned}
              onClick={() => {
                if (canFilterOwned) {
                  setPref("hideOwned", !hideOwned);
                }
              }}
              title={!canFilterOwned ? t("steam.signInFirst") : undefined}
            >
              {t("filter.hideOwned")}
            </FilterChip>
            {FAMILIES.map((family) => (
              <FilterChip
                key={family}
                active={families.includes(family)}
                onClick={() =>
                  setFamilies((prev) =>
                    prev.includes(family) ? prev.filter((f) => f !== family) : [...prev, family],
                  )
                }
              >
                {t(`platform.${family}` as MessageKey)}
              </FilterChip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="gp-eyebrow mr-1">{t("discover.genre")}</span>
            {allGenres.map((genre) => (
              <FilterChip
                key={genre}
                active={genres.includes(genre)}
                onClick={() =>
                  setGenres((prev) =>
                    prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
                  )
                }
              >
                {genre}
              </FilterChip>
            ))}
          </div>

          {releasesFeed.isPending && !releasesFeed.data ? null : (
            <span className="ml-auto text-xs text-muted-foreground">
              {t("discover.results", { count: games.length })}
            </span>
          )}
        </>
      }
    >
      {releasesFeed.isPending && !releasesFeed.data ? (
        <PanelSkeleton />
      ) : catalogue.length === 0 ? (
        <EmptyState title={t("feed.empty.title")} body={t("feed.empty.body")} />
      ) : games.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {games.map((game) => (
            <GameCard key={game.id} game={game} fluid />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("common.noResults")}
          body={t("common.reset")}
          action={
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGenres([]);
                setFamilies([]);
                setMineOnly(false);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-accent hover:text-accent"
            >
              {t("common.reset")}
            </button>
          }
        />
      )}
    </PageShell>
  );
}
