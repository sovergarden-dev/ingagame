import { Activity } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-accent/40 bg-accent-soft text-accent gp-glow"
      >
        <Activity className="size-4.5" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate font-display text-base font-bold uppercase tracking-[0.14em] text-foreground">
            {t("app.name")}
          </span>
          <span className="block truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("app.tagline")}
          </span>
        </span>
      )}
    </span>
  );
}
