import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Compass, Gift, Home, Newspaper, Radar, Settings, Star, Tag } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { isDefaultRadarEvent } from "@/domain/editions";
import { radarWinners } from "@/domain/conflicts";
import { useFormatReleaseDate } from "./use-format-release";
import { useNow } from "@/hooks/use-now";
import { splitReleaseItems, uniqueGamesFromReleases } from "@/integrations/content/feed";
import { useReleasesFeed } from "@/integrations/content/use-content-feed";
import { useI18n } from "@/i18n/I18nProvider";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { displayTitle, searchHaystack } from "@/domain/title";

const NAV_ITEMS = [
  { to: "/", labelKey: "nav.home", Icon: Home },
  { to: "/releases", labelKey: "nav.releases", Icon: Radar },
  { to: "/deals", labelKey: "nav.deals", Icon: Tag },
  { to: "/free", labelKey: "nav.free", Icon: Gift },
  { to: "/news", labelKey: "nav.news", Icon: Newspaper },
  { to: "/discover", labelKey: "nav.discover", Icon: Compass },
  { to: "/watchlist", labelKey: "nav.watchlist", Icon: Star },
  { to: "/settings", labelKey: "nav.settings", Icon: Settings },
] as const;

/** Search across the current catalogue and routes. Actions without a target stay out. */
export function CommandCenter({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { titleLanguage } = usePreferences();
  const formatWhen = useFormatReleaseDate();
  const navigate = useNavigate();
  const releasesFeed = useReleasesFeed();
  const releaseEntries = releasesFeed.data?.items ?? [];
  const games = uniqueGamesFromReleases(releaseEntries).slice(0, 6);
  const now = useNow();
  const upcoming = radarWinners(
    splitReleaseItems(releaseEntries, now).upcoming.filter((entry) =>
      isDefaultRadarEvent(entry.event),
    ),
  ).slice(0, 4);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function go(to: string, params?: Record<string, string>) {
    onOpenChange(false);
    void navigate({ to, ...(params ? { params } : {}) } as never);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={t("command.title")}>
      <CommandInput placeholder={t("search.placeholder")} />
      <CommandList label={t("command.title")} className="max-h-[60vh]">
        <CommandEmpty>{t("command.empty")}</CommandEmpty>

        <CommandGroup heading={t("command.games")}>
          {games.map((game) => (
            <CommandItem
              key={game.id}
              value={`game ${searchHaystack(game)}`}
              onSelect={() => go("/game/$slug", { slug: game.slug })}
            >
              <img src={game.coverUrl} alt="" className="mr-2 size-6 rounded object-cover" />
              <span>{displayTitle(game, titleLanguage)}</span>
              <span className="ml-auto text-xs text-muted-foreground">{game.developer}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("command.releases")}>
          {upcoming.map(({ game, event }) => (
            <CommandItem
              key={event.id}
              value={`release ${searchHaystack(game)}`}
              onSelect={() => go("/game/$slug", { slug: game.slug })}
            >
              <Radar className="mr-2 size-4 text-accent" />
              <span>{displayTitle(game, titleLanguage)}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatWhen(event.date, event.precision)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("command.navigation")}>
          {NAV_ITEMS.map(({ to, labelKey, Icon }) => {
            const label = t(labelKey);
            const value = to === "/" ? "home" : to.replace(/^\//, "").replaceAll("/", "-");
            return (
              <CommandItem key={to} value={value} keywords={[label]} onSelect={() => go(to)}>
                <Icon className="mr-2 size-4" />
                {label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
