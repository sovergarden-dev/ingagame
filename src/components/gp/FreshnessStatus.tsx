import { CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import type { FreshnessStatus as Status } from "@/domain/types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Visual-only "instant resume" indicator. No caching logic lives here. */
export function FreshnessStatus({ status, className }: { status: Status; className?: string }) {
  const { t } = useI18n();

  const map = {
    fresh: {
      icon: <CheckCircle2 aria-hidden className="size-3.5 text-success" />,
      text: t("freshness.upToDate"),
    },
    stale: {
      icon: <RefreshCw aria-hidden className="size-3.5 text-muted-foreground" />,
      text: t("freshness.ago", { n: status.minutesAgo }),
    },
    refreshing: {
      icon: <RefreshCw aria-hidden className="size-3.5 animate-spin text-accent" />,
      text: `${t("freshness.ago", { n: status.minutesAgo })} · ${t("freshness.refreshing")}`,
    },
    changed: {
      icon: <Sparkles aria-hidden className="size-3.5 text-accent" />,
      text: t("freshness.changed", { n: status.changeCount ?? 0 }),
    },
  } as const;

  const view = map[status.state];

  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-xs text-muted-foreground",
        className,
      )}
      aria-live="polite"
    >
      {view.icon}
      {view.text}
    </p>
  );
}
