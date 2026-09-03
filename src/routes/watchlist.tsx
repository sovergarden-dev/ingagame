import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { PlaceholderPage } from "@/components/gp/PlaceholderPage";
import { CountdownChip } from "@/components/gp/CountdownCard";
import { EmptyState } from "@/components/gp/EmptyState";
import { UPCOMING_RELEASES } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";
import { useLibrary } from "@/library/LibraryProvider";

export const Route = createFileRoute("/watchlist")({
  head: () => ({
    meta: [
      { title: "Watchlist & Alerts — GamePulse" },
      {
        name: "description",
        content: "The games you wishlisted or follow, with countdowns and delay alerts in one list.",
      },
      { property: "og:title", content: "Watchlist & Alerts — GamePulse" },
      { property: "og:description", content: "Your wishlisted and followed games with countdowns." },
    ],
  }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const { t } = useI18n();
  const { wishlist, following } = useLibrary();
  const tracked = UPCOMING_RELEASES.filter(
    ({ game }) => wishlist.includes(game.id) || following.includes(game.id),
  );

  return (
    <PlaceholderPage title={t("page.watchlist.title")} description={t("page.placeholder")}>
      {tracked.length ? (
        <div className="gp-panel grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {tracked.map(({ game, event }) => (
            <CountdownChip key={event.id} game={game} event={event} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={t("empty.title")}
          body={t("empty.body")}
          icon={<Star aria-hidden className="size-5" />}
        />
      )}
    </PlaceholderPage>
  );
}
