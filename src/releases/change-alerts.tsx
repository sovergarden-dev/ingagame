import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trackedReleaseChanges } from "@/domain/release-changes";
import { shouldDeliverAlert } from "@/domain/watch-controls";
import { useWatchControls } from "@/watch/WatchControlsProvider";
import { useFormatReleaseDate } from "@/components/gp/use-format-release";
import { useReleasesFeed } from "@/integrations/content/use-content-feed";
import { useLibrary } from "@/library/LibraryProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { displayTitle } from "@/domain/title";
import { usePreferences } from "@/preferences/PreferencesProvider";

const SEEN_KEY = "inga.releaseAlerts.seen";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** One toast per tracked release whose catalogue records a previous date. */
export function ReleaseChangeAlerts({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const { titleLanguage } = usePreferences();
  const formatWhen = useFormatReleaseDate();
  const { data } = useReleasesFeed();
  const { wishlist, following } = useLibrary();
  const watch = useWatchControls();
  const [ready, setReady] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = new Set(readSeen());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !watch.hydrated) return;
    const tracked = new Set([...wishlist, ...following]);
    const changes = trackedReleaseChanges(data?.items ?? [], tracked);
    const fresh = changes.filter(
      (entry) => !seenRef.current.has(entry.event.id) && shouldDeliverAlert(watch, entry.game.id),
    );
    if (fresh.length === 0) return;
    fresh.forEach((entry) => {
      seenRef.current.add(entry.event.id);
      toast(t("release.alert.title"), {
        description: t("release.alert.body", {
          title: displayTitle(entry.game, titleLanguage),
          date: formatWhen(entry.event.date, entry.event.precision),
        }),
      });
    });
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seenRef.current]));
    } catch {
      /* storage unavailable */
    }
  }, [data?.items, wishlist, following, ready, t, formatWhen, watch, titleLanguage]);

  return children;
}
