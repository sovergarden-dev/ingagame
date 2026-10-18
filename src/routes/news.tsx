import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { canonicalLinks } from "@/domain/seo";
import { ExternalLink, Newspaper } from "lucide-react";
import { PageShell } from "@/components/gp/PageShell";
import { FilterChip } from "@/components/gp/FilterChip";
import { SteamOwnershipBadge } from "@/components/gp/SteamOwnershipBadge";
import { EmptyState } from "@/components/gp/EmptyState";
import { FeedGate } from "@/components/gp/FeedGate";
import { freshnessFromFeed } from "@/integrations/content/feed";
import { feedGateProps, useNewsFeed } from "@/integrations/content/use-content-feed";
import { useI18n } from "@/i18n/I18nProvider";
import { displayTitle } from "@/domain/title";
import { articlesForFollowed, toGameSummary } from "@/domain/news";
import { useLibrary } from "@/library/LibraryProvider";
import { usePreferences } from "@/preferences/PreferencesProvider";
import type { Article } from "@/domain/types";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Gaming News & Official Updates — Inga" },
      {
        name: "description",
        content:
          "Release announcements, delays and official patch notes, filtered to what you follow.",
      },
      { property: "og:title", content: "Gaming News & Official Updates — Inga" },
      { property: "og:description", content: "Announcements, delays and official updates." },
    ],
    links: canonicalLinks("/news"),
  }),
  component: NewsPage,
});

function NewsPage() {
  const { t, locale } = useI18n();
  const { titleLanguage } = usePreferences();
  const { following } = useLibrary();
  const feed = useNewsFeed();
  const articlesFeed = useMemo(() => feed.data?.items ?? [], [feed.data?.items]);
  const [sources, setSources] = useState<string[]>([]);
  const [followedOnly, setFollowedOnly] = useState(false);

  const allSources = useMemo(
    () => [...new Set(articlesFeed.map((a) => a.source))].sort(),
    [articlesFeed],
  );
  const articles = useMemo(() => {
    const bySource = sources.length
      ? articlesFeed.filter((a) => sources.includes(a.source))
      : articlesFeed;
    const list = followedOnly ? articlesForFollowed(bySource, following) : bySource;
    return [...list].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  }, [articlesFeed, sources, followedOnly, following]);
  const freshness = freshnessFromFeed(feed.data, feed.isPending, Date.now(), feed.isError);

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
      freshness={freshness}
      toolbar={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="gp-eyebrow mr-1">{t("news.source")}</span>
          <FilterChip active={followedOnly} onClick={() => setFollowedOnly((value) => !value)}>
            {t("filter.followedOnly")}
          </FilterChip>
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
      <FeedGate {...feedGateProps(feed)}>
        {!lead ? (
          <EmptyState
            title={t("common.noResults")}
            icon={<Newspaper aria-hidden className="size-5" />}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <article className="gp-panel overflow-hidden">
              {(() => {
                const target = lead.gameSummary ?? toGameSummary(lead.game);
                const game = lead.game;
                const cover = lead.imageUrl ?? game?.backdropUrl ?? target?.coverUrl;
                return (
                  <>
                    {cover && (
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="h-48 w-full object-cover sm:h-64"
                      />
                    )}
                    <div className="space-y-2 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="gp-eyebrow">{t("news.latest")}</p>
                        {target && <SteamOwnershipBadge game={target} variant="compact" />}
                      </div>
                      <h2 className="text-xl font-semibold leading-snug text-foreground">
                        {lead.url ? (
                          <a
                            href={lead.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 transition-colors hover:text-accent"
                          >
                            <span>{lead.title}</span>
                            <ExternalLink className="size-4 shrink-0 opacity-70" />
                          </a>
                        ) : (
                          lead.title
                        )}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {lead.source} · {fmt.format(new Date(lead.publishedAt))}
                      </p>
                      {game?.slug ? (
                        <Link
                          to="/game/$slug"
                          params={{ slug: game.slug }}
                          className="inline-flex text-xs font-medium text-accent hover:underline"
                        >
                          {t("news.related")}: {displayTitle(game, titleLanguage)}
                        </Link>
                      ) : target?.title ? (
                        <span className="text-xs font-medium text-muted-foreground">
                          {t("news.related")}: {target.title}
                        </span>
                      ) : null}
                    </div>
                  </>
                );
              })()}
            </article>

            <ul className="gp-panel divide-y divide-border p-2">
              {others.map((a: Article) => {
                const target = a.gameSummary ?? toGameSummary(a.game);
                const game = a.game;
                const cover = a.imageUrl ?? target?.coverUrl;
                return (
                  <li key={a.id} className="flex gap-3 p-3">
                    {cover && (
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="size-14 shrink-0 rounded-md border border-border object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                          {a.url ? (
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="transition-colors hover:text-accent"
                            >
                              {a.title}
                            </a>
                          ) : (
                            a.title
                          )}
                        </p>
                        {target && <SteamOwnershipBadge game={target} variant="compact" />}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {a.source} · {fmt.format(new Date(a.publishedAt))}
                      </p>
                      {game?.slug ? (
                        <Link
                          to="/game/$slug"
                          params={{ slug: game.slug }}
                          className="mt-1 inline-flex text-[11px] font-medium text-accent hover:underline"
                        >
                          {displayTitle(game, titleLanguage)}
                        </Link>
                      ) : target?.title ? (
                        <span className="mt-1 inline-flex text-[11px] font-medium text-muted-foreground">
                          {target.title}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </FeedGate>
    </PageShell>
  );
}
