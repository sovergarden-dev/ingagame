import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BellRing,
  CalendarPlus,
  Compass,
  Gift,
  Home,
  Newspaper,
  Radar,
  ScanSearch,
  Settings,
  Star,
  Tag,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { formatReleaseDate } from "@/domain/release";
import { splitReleaseItems, uniqueGamesFromReleases } from "@/integrations/content/feed";
import { useReleasesFeed } from "@/integrations/content/use-content-feed";
import { useI18n } from "@/i18n/I18nProvider";

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

/** Visual shell for the future command center. No search backend here. */
export function CommandCenter({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const releasesFeed = useReleasesFeed();
  const releaseEntries = releasesFeed.data?.items ?? [];
  const games = uniqueGamesFromReleases(releaseEntries).slice(0, 6);
  const upcoming = splitReleaseItems(releaseEntries).upcoming.slice(0, 4);

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
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("search.placeholder")} />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>{t("command.empty")}</CommandEmpty>

        <CommandGroup heading={t("command.games")}>
          {games.map((game) => (
            <CommandItem
              key={game.id}
              value={`game ${game.title}`}
              onSelect={() => go("/game/$slug", { slug: game.slug })}
            >
              <img src={game.coverUrl} alt="" className="mr-2 size-6 rounded object-cover" />
              <span>{game.title}</span>
              <span className="ml-auto text-xs text-muted-foreground">{game.developer}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t("command.releases")}>
          {upcoming.map(({ game, event }) => (
            <CommandItem
              key={event.id}
              value={`release ${game.title}`}
              onSelect={() => go("/game/$slug", { slug: game.slug })}
            >
              <Radar className="mr-2 size-4 text-accent" />
              <span>{game.title}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatReleaseDate(event.date, event.precision, locale)}
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

        <CommandSeparator />

        <CommandGroup heading={t("command.actions")}>
          <CommandItem value="scan new releases">
            <ScanSearch className="mr-2 size-4" />
            {t("command.action.scan")}
          </CommandItem>
          <CommandItem value="add to wishlist">
            <Star className="mr-2 size-4" />
            {t("command.action.wishlist")}
          </CommandItem>
          <CommandItem value="add to calendar">
            <CalendarPlus className="mr-2 size-4" />
            {t("command.action.calendar")}
          </CommandItem>
          <CommandItem value="alerts and notifications" onSelect={() => go("/settings")}>
            <BellRing className="mr-2 size-4" />
            {t("command.action.alerts")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
