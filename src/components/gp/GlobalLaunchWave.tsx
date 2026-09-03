import { Globe2 } from "lucide-react";
import type { RegionLaunch } from "@/domain/types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/**
 * Design-reference component: shows a launch moment across regions.
 * Production logic will only show this for exact, trusted timestamps.
 */
export function GlobalLaunchWave({
  regions,
  title,
  className,
}: {
  regions: RegionLaunch[];
  title?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <section className={cn("gp-panel p-4 sm:p-5", className)} aria-label={t("section.launchWave")}>
      <header className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-accent">
          <Globe2 aria-hidden className="size-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("section.launchWave")}</h3>
          <p className="text-xs text-muted-foreground">{title ?? t("section.launchWave.sub")}</p>
        </div>
      </header>

      <ol className="mt-4 space-y-1">
        {regions.map((r) => (
          <li
            key={r.region}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm",
              r.isUserRegion
                ? "border border-accent/50 bg-accent-soft text-foreground"
                : "text-muted-foreground",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  r.isUserRegion ? "bg-accent" : "bg-border-strong",
                )}
              />
              <span className="truncate">
                {r.region}{" "}
                <span className="text-xs text-muted-foreground">({r.timezoneLabel})</span>
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
              {r.localTime}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
