import { Gamepad2 } from "lucide-react";
import type { Game, GameSummary } from "@/domain/types";
import { useSteam } from "@/integrations/steam/SteamProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export function SteamOwnershipBadge({
  game,
  variant = "full",
  className,
}: {
  game: Game | GameSummary;
  variant?: "full" | "compact";
  className?: string;
}) {
  const { owns } = useSteam();
  const { t } = useI18n();

  if (!owns(game)) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-surface-2/90 font-medium text-foreground shadow-xs",
        variant === "compact" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className,
      )}
      aria-label={t("steam.owned")}
      title={t("steam.owned")}
    >
      <Gamepad2 className="size-3 text-accent" />
      {variant === "full" ? <span>{t("steam.owned")}</span> : null}
    </span>
  );
}
