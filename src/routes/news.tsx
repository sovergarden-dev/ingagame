import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { FilterChip } from "@/components/gp/FilterChip";
import { EmptyState } from "@/components/gp/EmptyState";
import { ARTICLES, getGame } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Gaming News & Official Updates — GamePulse" },
      {
        name: "description",
        content:
          "Release announcements, delays and official patch notes, filtered to what you follow.",
      },
      { property: "og:title", content: "Gaming News & Official Updates — GamePulse" },
      { property: "og:description", content: "Announcements, delays and official updates." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { t, locale } = useI18n();
  const [sources, setSources] = useState<string[]>([]);

  const allSources = useMemo(() => [...new Set(ARTICLES.map((a) => a.source))].sort(), []);
  const articles = useMemo(() => {
    const list = sources.length ? ARTICLES.filter((a) => sources.includes(a.source)) : ARTICLES;
    return [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  }, [sources]);

  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const [lead, ...others] = articles;

  return (
    <PageShell
      title={t("page.news.title")}
      description={t("page.news.subtitle")}
      freshness={{ state: "fresh", minutesAgo: 6 }}
      toolbar={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="gp-eyebrow mr-1">{t("news.source")}</span>
          {allSources.map((source) => (
            <FilterChip
              key={source}
              active={sources.includes(source)}
              onClick={() =>
                setSources((prev) =>
                  prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
                )
              }
            >
              {source}
            </FilterChip>
          ))}
          {sources.length > 0 && (
            <button
              type="button"
              onClick={() => setSources([])}
              className="ml-1 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-accent hover:underline"
            >
              {t("common.reset")}
            </button>
          )}
        </div>
      }
    >
      {!lead ? (
        <EmptyState
          title={t("common.noResults")}
          icon={<Newspaper aria-hidden className="size-5" />}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <article className="gp-panel overflow-hidden">
            {(() => {
              const game = lead.gameId ? getGame(lead.gameId) : undefined;
              return (
                <>
                  {game && (
                    <img
                      src={game.backdropUrl ?? game.coverUrl}
                      alt=""
                      loading="lazy"
                      className="h-48 w-full object-cover sm:h-64"
                    />
                  )}
                  <div className="space-y-2 p-5">
                    <p className="gp-eyebrow">{t("news.latest")}</p>
                    <h2 className="text-xl font-semibold leading-snug text-foreground">
                      {lead.title}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {lead.source} · {fmt.format(new Date(lead.publishedAt))}
                    </p>
                    {game && (
                      <Link
                        to="/game/$slug"
                        params={{ slug: game.slug }}
                        className="inline-flex text-xs font-medium text-accent hover:underline"
                      >
                        {t("news.related")}: {game.title}
                      </Link>
                    )}
                  </div>
                </>
              );
            })()}
          </article>

          <ul className="gp-panel divide-y divide-border p-2">
            {others.map((a) => {
              const game = a.gameId ? getGame(a.gameId) : undefined;
              return (
                <li key={a.id} className="flex gap-3 p-3">
                  {game && (
                    <img
                      src={game.coverUrl}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-md border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                      {a.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.source} · {fmt.format(new Date(a.publishedAt))}
                    </p>
                    {game && (
                      <Link
                        to="/game/$slug"
                        params={{ slug: game.slug }}
                        className="mt-1 inline-flex text-[11px] font-medium text-accent hover:underline"
                      >
                        {game.title}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </PageShell>
  );
}
