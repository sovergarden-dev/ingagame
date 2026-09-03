import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/gp/PlaceholderPage";
import { GameCardCompact } from "@/components/gp/GameCard";
import { GIVEAWAYS, getGame } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/free")({
  head: () => ({
    meta: [
      { title: "Free Games & Giveaways — GamePulse" },
      {
        name: "description",
        content: "Every game that is free to claim right now, with expiry times you can trust.",
      },
      { property: "og:title", content: "Free Games & Giveaways — GamePulse" },
      { property: "og:description", content: "Games free to claim right now, with expiry times." },
    ],
  }),
  component: FreePage,
});

function FreePage() {
  const { t } = useI18n();
  return (
    <PlaceholderPage title={t("page.free.title")} description={t("page.placeholder")}>
      <div className="gp-panel space-y-1 p-4">
        {GIVEAWAYS.map((g) => {
          const game = getGame(g.gameId);
          if (!game) return null;
          return (
            <GameCardCompact
              key={g.id}
              game={game}
              trailing={
                <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                  {g.store}
                </span>
              }
            />
          );
        })}
      </div>
    </PlaceholderPage>
  );
}
