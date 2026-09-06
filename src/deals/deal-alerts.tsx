import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DEALS, getGame } from "@/domain/mock-data";
import { isDealExpired, parseDealEndMs } from "@/domain/deal";
import type { Deal } from "@/domain/types";
import { useNow } from "@/hooks/use-now";
import { useI18n } from "@/i18n/I18nProvider";

const SEEN_KEY = "gamepulse.dealAlerts.seen";

export type DealAlert = {
  deal: Deal;
  title: string;
  slug: string;
  expiredAt: number;
};

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
}

/** Deals whose end date has passed, newest expiry first. */
export function useExpiredDeals(): DealAlert[] {
  const now = useNow();
  return useMemo(() => {
    if (now === null) return [];
    return DEALS.flatMap((deal) => {
      if (!isDealExpired(deal.endsAt, now)) return [];
      const expiredAt = parseDealEndMs(deal.endsAt);
      if (expiredAt === null) return [];
      const game = getGame(deal.gameId);
      if (!game) return [];
      return [{ deal, title: game.title, slug: game.slug, expiredAt }];
    }).sort((a, b) => b.expiredAt - a.expiredAt);
  }, [now]);
}

const DealAlertsContext = createContext<DealAlert[]>([]);

export function useDealAlerts() {
  return useContext(DealAlertsContext);
}

/** Watches deal expiry and raises a toast the first time each deal ends. */
export function DealAlertsProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const expired = useExpiredDeals();
  const [ready, setReady] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    seenRef.current = new Set(readSeen());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const fresh = expired.filter((a) => !seenRef.current.has(a.deal.id));
    if (fresh.length === 0) return;
    fresh.forEach((alert) => {
      seenRef.current.add(alert.deal.id);
      toast(t("deals.alert.title"), {
        description: t("deals.alert.body", { title: alert.title, store: alert.deal.store }),
      });
    });
    writeSeen([...seenRef.current]);
  }, [expired, ready, t]);

  return <DealAlertsContext.Provider value={expired}>{children}</DealAlertsContext.Provider>;
}
