import { useEffect, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { CalendarPlus, PlayCircle, Share2, Star } from "lucide-react";
import { similarGames, sharedGenres } from "@/domain/similar";
import { sharesHiddenGenre } from "@/domain/discover";
import { mergeGameReleaseEvents, relatedContent } from "@/domain/editions";
import { releaseConflicts } from "@/domain/conflicts";
import { recordedSource } from "@/domain/trust";
import { canExportCalendar, primaryRelease, releaseEventIcs } from "@/domain/calendar";
import { dealsForGame } from "@/domain/deal";
import { articlesForGame } from "@/domain/news";
import { trustedLaunchWave } from "@/domain/launch-wave";
import { GAMES_BY_SLUG, VIDEOS } from "@/domain/mock-data";
import { findGameBySlug, uniqueGamesFromReleases } from "@/integrations/content/feed";
import {
  feedGateProps,
  useDealsFeed,
  useNewsFeed,
  useReleasesFeed,
} from "@/integrations/content/use-content-feed";
import { isCountdownable, isReleaseStillAhead } from "@/domain/release";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlatformBadge } from "@/components/gp/PlatformBadge";
import { SteamOwnershipBadge } from "@/components/gp/SteamOwnershipBadge";
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
import { ScreenshotGallery } from "@/components/gp/ScreenshotGallery";
import { EmptyState } from "@/components/gp/EmptyState";
import { FeedGate } from "@/components/gp/FeedGate";
import { PanelSkeleton } from "@/components/gp/Skeletons";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/library/LibraryProvider";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { displayTitle, gameDocumentTitle } from "@/domain/title";
import { canonicalLinks, gameCanonicalPath, canonicalUrl, videoGameJsonLd } from "@/domain/seo";
import { useFormatReleaseDate } from "@/components/gp/use-format-release";
import { useWatchControls } from "@/watch/WatchControlsProvider";
import { useHiddenGames } from "@/discover/HiddenGamesProvider";
import { usePins } from "@/pins/PinsProvider";
import { useNow } from "@/hooks/use-now";
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
      links: (() => {
        const path = gameCanonicalPath(params.slug);
        return path ? canonicalLinks(path) : [];
      })(),
    };
  },
  component: GameDetail,
});

function GameDetail() {
  const { slug } = Route.useLoaderData();
  const { t, locale } = useI18n();
  const now = useNow();
  const { spoilerSafe, titleLanguage } = usePreferences();
  const formatWhen = useFormatReleaseDate();
  const [copied, setCopied] = useState(false);
  const { isFollowing, toggleFollow } = useLibrary();
  const watch = useWatchControls();
  const hidden = useHiddenGames();
  const pins = usePins();
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
  const title = game ? displayTitle(game, titleLanguage) : "";

  useEffect(() => {
    if (!title) return;
    document.title = gameDocumentTitle(title);
  }, [title]);

  useEffect(() => {
    const path = game ? gameCanonicalPath(game.slug) : null;
    const url = path ? canonicalUrl(path) : null;
    const primary = game ? primaryRelease(game.releaseEvents) : undefined;
    const data =
      game && url
        ? videoGameJsonLd({
            name: title,
            url,
            ...(spoilerSafe || !game.summary ? {} : { description: game.summary }),
            ...(primary ? { date: primary.date, precision: primary.precision } : {}),
          })
        : null;
    const existing = document.getElementById("game-jsonld");
    if (!data) {
      existing?.remove();
      return;
    }
    const script = existing ?? document.createElement("script");
    script.id = "game-jsonld";
    script.setAttribute("type", "application/ld+json");
    script.textContent = JSON.stringify(data);
    if (!existing) document.head.appendChild(script);
    return () => script.remove();
  }, [game, spoilerSafe, title]);

  if (pendingIdentity) return <PanelSkeleton rows={6} />;
  if (!game) throw notFound();

  const allEvents = mergeGameReleaseEvents(
    game.releaseEvents,
    releasesFeed.data?.items ?? [],
    game,
  );
  const primary = primaryRelease(allEvents.length ? allEvents : game.releaseEvents);
  const launchWave = trustedLaunchWave(allEvents.length ? allEvents : game.releaseEvents, locale);
  const deals = dealsForGame(dealsFeed.data?.items ?? [], game);
  const news = articlesForGame(newsFeed.data?.items ?? [], game);
  const videos = (import.meta.env.DEV ? VIDEOS.filter((v) => v.gameId === game.id) : []).filter(
    (video) => video.url,
  );
  const trailer = videos.find((video) => video.kind === "trailer");
  const catalogue = uniqueGamesFromReleases(releasesFeed.data?.items ?? []).filter(
    (item) => !sharesHiddenGenre(item.genres, hidden.genres),
  );
  const similar = similarGames(game, catalogue, 6, hidden.ids);
  const related = relatedContent(allEvents.length ? allEvents : game.releaseEvents);
  const conflicts = new Set(
    releaseConflicts(allEvents.length ? allEvents : game.releaseEvents).map(
      (item) => item.event.id,
    ),
  );
  const shots = game.screenshots ?? [];
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
            alt={t("media.coverAlt", { title })}
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
            <h1 className="mt-2 break-words text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            {title === game.title ? (
              game.originalTitle && game.originalTitle !== title ? (
                <p className="text-sm text-muted-foreground">{game.originalTitle}</p>
              ) : null
            ) : (
              <p className="text-sm text-muted-foreground">{game.title}</p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {game.developer} · {game.publisher}
            </p>
            {primary ? (
              <p className="mt-2 text-sm text-foreground/90">
                {formatWhen(primary.date, primary.precision)}
                {now !== null &&
                primary.state !== "available" &&
                !isReleaseStillAhead(primary, now) ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t("watchlist.passed")}
                  </span>
                ) : null}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {game.platforms.map((p) => (
                <PlatformBadge key={p} platform={p} size="sm" />
              ))}
              <SteamOwnershipBadge game={game} />
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
              <Button
                variant="glass"
                size="lg"
                onClick={() => watch.toggleMute(game.id)}
                aria-pressed={watch.isMuted(game.id)}
              >
                {watch.isMuted(game.id) ? t("watch.unmute") : t("watch.mute")}
              </Button>
              <Button
                variant="glass"
                size="lg"
                onClick={() => hidden.toggle(game.id)}
                aria-pressed={hidden.isHidden(game.id)}
              >
                {hidden.isHidden(game.id) ? t("hide.show") : t("hide.discover")}
              </Button>
              {primary &&
              now !== null &&
              isCountdownable(primary) &&
              isReleaseStillAhead(primary, now) ? (
                <Button
                  variant="glass"
                  size="lg"
                  onClick={() => pins.toggle(game.id)}
                  aria-pressed={pins.isPinned(game.id)}
                >
                  {pins.isPinned(game.id) ? t("pin.remove") : t("pin.add")}
                </Button>
              ) : null}
              {trailer ? (
                <Button variant="glass" size="lg" asChild>
                  <a href={trailer.url} target="_blank" rel="noreferrer">
                    <PlayCircle />
                    {t("action.trailer")}
                  </a>
                </Button>
              ) : null}
              {primary && canExportCalendar(primary) ? (
                <Button
                  variant="glass"
                  size="lg"
                  onClick={() => {
                    const ics = releaseEventIcs(primary, title);
                    if (!ics) return;
                    const blob = new Blob([ics], { type: "text/calendar" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${game.slug}.ics`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <CalendarPlus />
                  {t("action.addToCalendar")}
                </Button>
              ) : null}
              <Button
                variant="glass"
                size="lg"
                onClick={() => {
                  const url = window.location.href;
                  const share = navigator.share?.bind(navigator);
                  if (share) {
                    void share({ title, url }).catch(() => undefined);
                    return;
                  }
                  void navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                  });
                }}
              >
                <Share2 />
                {copied ? t("action.copied") : t("action.share")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-surface p-1">
          <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
          <TabsTrigger value="release">{t("tabs.release")}</TabsTrigger>
          <TabsTrigger value="editions">{t("tabs.editions")}</TabsTrigger>
          <TabsTrigger value="deals">{t("tabs.deals")}</TabsTrigger>
          <TabsTrigger value="news">{t("tabs.news")}</TabsTrigger>
          <TabsTrigger value="trailers">{t("tabs.trailers")}</TabsTrigger>
          <TabsTrigger value="screenshots">{t("tabs.screenshots")}</TabsTrigger>
          <TabsTrigger value="similar">{t("tabs.similar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="gp-panel p-5 lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground">{t("tabs.overview")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {spoilerSafe ? t("spoiler.hidden") : game.summary}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="gp-eyebrow">{t("game.developer")}</dt>
                <dd className="mt-1 text-foreground">{game.developer}</dd>
              </div>
              <div>
                <dt className="gp-eyebrow">{t("game.publisher")}</dt>
                <dd className="mt-1 text-foreground">{game.publisher}</dd>
              </div>
              <div>
                <dt className="gp-eyebrow">{t("game.genres")}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5 text-foreground">
                  {game.genres.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      aria-pressed={hidden.isGenreHidden(genre)}
                      onClick={() => hidden.toggleGenre(genre)}
                      className="inline-flex min-h-11 items-center rounded-full border border-border px-3 py-2 text-xs sm:min-h-0 sm:px-2 sm:py-0.5"
                    >
                      {hidden.isGenreHidden(genre)
                        ? t("hide.genre.show", { genre })
                        : t("hide.genre", { genre })}
                    </button>
                  ))}
                </dd>
              </div>
            </dl>
          </div>
          {launchWave.length > 0 ? <GlobalLaunchWave regions={launchWave} /> : null}
        </TabsContent>

        <TabsContent value="release" className="mt-4 space-y-4">
          {primary &&
            now !== null &&
            isCountdownable(primary) &&
            isReleaseStillAhead(primary, now) && (
              <div className="gp-panel p-5">
                <p className="gp-eyebrow mb-2">{t("countdown.eyebrow")}</p>
                <CountdownUnits target={primary.date} />
              </div>
            )}
          <ul className="space-y-2">
            {(allEvents.length ? allEvents : game.releaseEvents).map((event) => (
              <li key={event.id} className="gp-panel flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {formatWhen(event.date, event.precision)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.note ?? event.region ?? "—"}
                  </p>
                  {now !== null &&
                  event.state !== "available" &&
                  !isReleaseStillAhead(event, now) ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t("watchlist.passed")}</p>
                  ) : null}
                  {conflicts.has(event.id) ? (
                    <p className="mt-1 text-xs text-muted-foreground">{t("trust.conflict")}</p>
                  ) : null}
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer text-foreground/80">
                      {t("trust.show")}
                    </summary>
                    <dl className="mt-2 grid gap-1">
                      <div>
                        <dt className="inline">{t("trust.source")}: </dt>
                        <dd className="inline">
                          {recordedSource(event) ?? t("trust.sourceMissing")}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">{t("trust.precision")}: </dt>
                        <dd className="inline">
                          {t(`precision.${event.precision}` as "precision.exact")}
                        </dd>
                      </div>
                      {event.timezone ? (
                        <div>
                          <dt className="inline">{t("trust.timezone")}: </dt>
                          <dd className="inline">{event.timezone}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </details>
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

        <TabsContent value="editions" className="mt-4">
          <FeedGate {...feedGateProps(releasesFeed)} showEmpty={false}>
            {related.length ? (
              <ul className="space-y-2">
                {related.map((event) => (
                  <li key={event.id} className="gp-panel flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {event.note ?? t(`kind.${event.kind}` as "kind.dlc")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(event.date, event.precision)}
                      </p>
                      {now !== null &&
                      event.state !== "available" &&
                      !isReleaseStillAhead(event, now) ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("watchlist.passed")}
                        </p>
                      ) : null}
                    </div>
                    <ReleaseKindBadge kind={event.kind} />
                    <ReleaseStatusBadge confidence={event.confidence} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("editions.none")} />
            )}
          </FeedGate>
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          <FeedGate {...feedGateProps(dealsFeed)} showEmpty={false}>
            {deals.length ? (
              <div className="gp-panel space-y-1 p-4">
                {deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} locale={locale} />
                ))}
              </div>
            ) : (
              <EmptyState title={t("deals.noneForGame")} />
            )}
          </FeedGate>
        </TabsContent>

        <TabsContent value="news" className="mt-4">
          <FeedGate {...feedGateProps(newsFeed)} showEmpty={false}>
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
              <EmptyState title={t("news.noneForGame")} />
            )}
          </FeedGate>
        </TabsContent>

        <TabsContent value="trailers" className="mt-4">
          {videos.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {videos.map((video) => (
                <a
                  key={video.id}
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border border-border"
                >
                  <img
                    src={video.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    width={1920}
                    height={1088}
                    className="aspect-video w-full object-cover"
                  />
                  <p className="p-3 text-sm font-medium text-foreground">{video.title}</p>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState title={t("media.noneTrailers")} />
          )}
        </TabsContent>

        <TabsContent value="screenshots" className="mt-4">
          {shots.length ? (
            <ScreenshotGallery shots={shots} />
          ) : (
            <EmptyState title={t("media.noneShots")} />
          )}
        </TabsContent>

        <TabsContent value="similar" className="mt-4">
          <SectionHeader title={t("tabs.similar")} />
          <div className="gp-scroll-x mt-3 flex gap-3 pb-2">
            {similar.length ? (
              similar.map((g) => (
                <div key={g.id} className="w-72 shrink-0 space-y-2">
                  <GameCard game={g} />
                  <p className="px-1 text-xs text-muted-foreground">
                    {t("similar.because", { genres: sharedGenres(game, g).join(", ") })}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState title={t("similar.none")} />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
