import { useEffect, useState } from "react";
import { formatReleaseDate, safeTimeZone } from "@/domain/release";
import type { ReleasePrecision } from "@/domain/types";
import { useI18n } from "@/i18n/I18nProvider";
import { usePreferences } from "@/preferences/PreferencesProvider";

/** UTC until after hydration, then the saved timezone. */
export function useDisplayTimeZone() {
  const { timezone } = usePreferences();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready ? safeTimeZone(timezone) : "UTC";
}

/** Exact clocks use the saved timezone. Coarser dates stay on UTC so the day does not shift. */
export function useFormatReleaseDate() {
  const { locale } = useI18n();
  const zone = useDisplayTimeZone();
  return (date: string, precision: ReleasePrecision) =>
    formatReleaseDate(date, precision, locale, precision === "exact" ? zone : "UTC");
}
