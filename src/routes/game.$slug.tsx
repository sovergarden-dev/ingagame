import { createFileRoute, notFound } from "@tanstack/react-router";
import { CalendarPlus, PlayCircle, Star } from "lucide-react";
import { GAMES_BY_SLUG, LAUNCH_WAVE, VIDEOS } from "@/domain/mock-data";
import { findGameBySlug, uniqueGamesFromReleases } from "@/integrations/content/feed";
import {
  feedGateProps,
  useDealsFeed,
  useNewsFeed,
  useReleasesFeed,
} from "@/integrations/content/use-content-feed";
import { formatReleaseDate, isCountdownable } from "@/domain/release";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/gp/PlatformBadge";
import {
  ReleaseKindBadge,
  ReleaseStateBadge,
  ReleaseStatusBadge,
} from "@/components/gp/ReleaseStatusBadge";
import { WishlistButton } from "@/components/gp/WishlistButton";
import { CountdownUnits } from "@/components/gp/CountdownCard";
import { GlobalLaunchWave } from "@/components/gp/GlobalLaunchWave";
import { GameCard } from "@/components/gp/GameCard";
import { DealCard } from "@/components/gp/DealCard";
import { EmptyState } from "@/components/gp/EmptyState";
import { FeedGate } from "@/components/gp/FeedGate";
import { PanelSkeleton } from "@/components/gp/Skeletons";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/library/LibraryProvider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/game/$slug")({
  loader: ({ params }) => ({ slug: params.slug }),
  head: ({ params }) => {
    const mock = import.meta.env.DEV ? GAMES_BY_SLUG.get(params.slug) : undefined;
    const title = mock ? `${mock.title} — Inga` : "Game — Inga";
    const description = mock
      ? `${mock.title} by ${mock.developer}. Release dates, countdown, platforms, deals and news.`
      : "Release dates, countdowns, platforms, deals and news.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: GameDetail,
});

function GameDetail() {
  const { slug } = Route.useLoaderData();
  const { t, locale } = useI18n();
  const { isFollowing, toggleFollow } = useLibrary();
  const releasesFeed = useReleasesFeed();
  const dealsFeed = useDealsFeed();
  const newsFeed = useNewsFeed();
  const fromFeed = findGameBySlug(slug, {
    releases: releasesFeed.data?.items,
    deals: dealsFeed.data?.items,
    news: newsFeed.data?.items,
  });
  const pendingIdentity =
    !fromFeed && (releasesFeed.isPending || dealsFeed.isPending || newsFeed.isPending);
  const game = fromFeed ?? (import.meta.env.DEV ? GAMES_BY_SLUG.get(slug) : undefined);

  if (pendingIdentity) return <PanelSkeleton rows={6} />;
  if (!game) throw notFound();

  const primary = game.releaseEvents[0];
  const deals = (dealsFeed.data?.items ?? []).filter((d) => d.gameId === game.id);
  const news = (newsFeed.data?.items ?? []).filter((a) => a.gameId === game.id);
  const videos = import.meta.env.DEV ? VIDEOS.filter((v) => v.gameId === game.id) : [];
  const similar = uniqueGamesFromReleases(releasesFeed.data?.items ?? [])
    .filter((g) => g.id !== game.id)
    .slice(0, 6);
  const following = isFollowing(game.id);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border">
        <img
          src={game.backdropUrl ?? game.coverUrl}
          alt=""
          width={1920}
          height={1088}
          className="absolute inset-0 size-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, oklch(from var(--background) l c h / 0.4) 0%, oklch(from var(--background) l c h / 0.9) 60%, var(--background) 100%)",
          }}
        />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-8">
          <img
            src={game.coverUrl}
            alt={`${game.title} cover art`}
            width={600}
            height={900}
            className="w-32 shrink-0 rounded-xl border border-border-strong object-cover shadow-lg sm:w-44"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {primary ? (
                <>
                  <ReleaseStatusBadge confidence={primary.confidence} />
                  <ReleaseKindBadge kind={primary.kind} />
                  <ReleaseStateBadge
                    state={primary.state}
                    {...(primary.delayDays ? { delayDays: primary.delayDays } : {})}
                  />
                </>
              ) : null}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {game.title}
            </h1>
            {game.originalTitle && (
              <p className="text-sm text-muted-foreground">{game.originalTitle}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {game.developer} · {game.publisher}
            </p>
            {primary ? (
              <p className="mt-2 text-sm text-foreground/90">
                {formatReleaseDate(primary.date, primary.precision, locale)}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {game.platforms.map((p) => (
                <PlatformBadge key={p} platform={p} size="sm" />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <WishlistButton gameId={game.id} variant="full" />
              <Button
                variant="glass"
                size="lg"
                onClick={() => toggleFollow(game.id)}
                aria-pressed={following}
              >
                <Star className={cn(following && "fill-current")} />
                {following ? t("action.following") : t("action.follow")}
              </Button>
              <Button variant="glass" size="lg">
                <PlayCircle />
                {t("action.trailer")}
              </Button>
              <Button variant="glass" size="lg">
                <CalendarPlus />
                {t("action.addToCalendar")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-surface p-1">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="release">{t("tabs.release")}</TabsTrigger>
          <TabsTrigger value="deals">{t("tabs.deals")}</TabsTrigger>
          <TabsTrigger value="news">{t("tabs.news")}</TabsTrigger>
          <TabsTrigger value="trailers">{t("tabs.trailers")}</TabsTrigger>
          <TabsTrigger value="similar">{t("tabs.similar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="gp-panel p-5 lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground">{t("tabs.overview")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{game.summary}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="gp-eyebrow">Developer</dt>
                <dd className="mt-1 text-foreground">{game.developer}</dd>
              </div>
              <div>
                <dt className="gp-eyebrow">Publisher</dt>
                <dd className="mt-1 text-foreground">{game.publisher}</dd>
              </div>
              <div>
                <dt className="gp-eyebrow">Genres</dt>
                <dd className="mt-1 text-foreground">{game.genres.join(", ")}</dd>
              </div>
            </dl>
          </div>
          <GlobalLaunchWave regions={LAUNCH_WAVE} />
        </TabsContent>

        <TabsContent value="release" className="mt-4 space-y-4">
          {primary && isCountdownable(primary) && primary.state !== "available" && (
            <div className="gp-panel p-5">
              <p className="gp-eyebrow mb-2">{t("countdown.eyebrow")}</p>
              <CountdownUnits target={primary.date} />
            </div>
          )}
          <ul className="space-y-2">
            {game.releaseEvents.map((event) => (
              <li key={event.id} className="gp-panel flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {formatReleaseDate(event.date, event.precision, locale)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.note ?? event.source ?? event.region ?? "—"}
                  </p>
                </div>
                <ReleaseKindBadge kind={event.kind} />
                <ReleaseStatusBadge confidence={event.confidence} />
                <div className="flex flex-wrap gap-1">
                  {event.platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} size="xs" />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          <FeedGate {...feedGateProps(dealsFeed)}>
            {deals.length ? (
              <div className="gp-panel space-y-1 p-4">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} locale={locale} />
                ))}
              </div>
            ) : (
              <EmptyState title={t("empty.title")} body={t("empty.body")} />
            )}
          </FeedGate>
        </TabsContent>

        <TabsContent value="news" className="mt-4">
          <FeedGate {...feedGateProps(newsFeed)}>
            {news.length ? (
              <ul className="gp-panel divide-y divide-border p-4">
                {news.map((a) => (
                  <li key={a.id} className="py-3">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{a.source}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("empty.title")} body={t("empty.body")} />
            )}
          </FeedGate>
        </TabsContent>

        <TabsContent value="trailers" className="mt-4">
          {videos.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {videos.map((v) => (
                <div key={v.id} className="overflow-hidden rounded-xl border border-border">
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    width={1920}
                    height={1088}
                    className="aspect-video w-full object-cover"
                  />
                  <p className="p-3 text-sm font-medium text-foreground">{v.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t("empty.title")} body={t("empty.body")} />
          )}
        </TabsContent>

        <TabsContent value="similar" className="mt-4">
          <SectionHeader title={t("tabs.similar")} />
          <div className="gp-scroll-x mt-3 flex gap-3 pb-2">
            {similar.length ? (
              similar.map((g) => <GameCard key={g.id} game={g} />)
            ) : (
              <EmptyState title={t("empty.title")} body={t("empty.body")} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
