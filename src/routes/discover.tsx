import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, Sparkles } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { FilterChip, Segmented } from "@/components/gp/FilterChip";
import { GameCard } from "@/components/gp/GameCard";
import { EmptyState } from "@/components/gp/EmptyState";
import { GAMES } from "@/domain/mock-data";
import { PLATFORM_FAMILIES, familyOf } from "@/domain/platforms";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import type { PlatformFamily } from "@/domain/types";
import { Input } from "@/components/ui/input";

type SortId = "hype" | "critic" | "title" | "soonest";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover Games — GamePulse" },
      {
        name: "description",
        content:
          "Browse games by genre, platform and hype, tuned to the platforms you actually own.",
      },
      { property: "og:title", content: "Discover Games — GamePulse" },
      { property: "og:description", content: "Browse games by genre, platform and hype." },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [families, setFamilies] = useState<PlatformFamily[]>([]);
  const [sort, setSort] = useState<SortId>("hype");

  const allGenres = useMemo(
    () => [...new Set(GAMES.flatMap((g) => g.genres))].sort().slice(0, 12),
    [],
  );

  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = GAMES.filter((game) => {
      if (q && !`${game.title} ${game.developer} ${game.publisher}`.toLowerCase().includes(q))
        return false;
      if (genres.length && !game.genres.some((g) => genres.includes(g))) return false;
      if (families.length && !game.platforms.some((p) => families.includes(familyOf(p))))
        return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "hype") return (b.hypeScore ?? 0) - (a.hypeScore ?? 0);
      if (sort === "critic") return (b.criticScore ?? 0) - (a.criticScore ?? 0);
      if (sort === "title") return a.title.localeCompare(b.title);
      const av = a.releaseEvents[0] ? Date.parse(a.releaseEvents[0].date) : Number.MAX_SAFE_INTEGER;
      const bv = b.releaseEvents[0] ? Date.parse(b.releaseEvents[0].date) : Number.MAX_SAFE_INTEGER;
      return av - bv;
    });
  }, [query, genres, families, sort]);

  return (
    <PageShell
      title={t("page.discover.title")}
      description={t("page.discover.subtitle")}
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
            {PLATFORM_FAMILIES.map((family) => (
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

          <span className="ml-auto text-xs text-muted-foreground">
            {t("discover.results", { count: games.length })}
          </span>
        </>
      }
    >
      {games.length ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
          {games.map((game) => (
            <GameCard key={game.id} game={game} className="w-full" />
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
