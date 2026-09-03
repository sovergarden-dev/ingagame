import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/gp/PlaceholderPage";
import { GameCard } from "@/components/gp/GameCard";
import { GAMES } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover Games — GamePulse" },
      {
        name: "description",
        content: "Browse games by genre, platform and hype, tuned to the platforms you actually own.",
      },
      { property: "og:title", content: "Discover Games — GamePulse" },
      { property: "og:description", content: "Browse games by genre, platform and hype." },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { t } = useI18n();
  return (
    <PlaceholderPage title={t("page.discover.title")} description={t("page.placeholder")}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
        {GAMES.map((game) => (
          <GameCard key={game.id} game={game} className="w-full" />
        ))}
      </div>
    </PlaceholderPage>
  );
}
