import { BadgeCheck, CircleHelp, Clock3, Sparkles, TriangleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/messages";
import type { ReleaseConfidence, ReleaseKind, ReleaseState } from "@/domain/types";
import { cn } from "@/lib/utils";

const CONFIDENCE_STYLES: Record<ReleaseConfidence, { className: string; Icon: typeof BadgeCheck }> =
  {
    confirmed: { className: "border-success/40 text-success bg-success/10", Icon: BadgeCheck },
    high: { className: "border-info/40 text-info bg-info/10", Icon: Sparkles },
    expected: { className: "border-warning/40 text-warning bg-warning/10", Icon: Clock3 },
    unconfirmed: {
      className: "border-border-strong text-muted-foreground bg-surface-2",
      Icon: CircleHelp,
    },
    tba: { className: "border-border-strong text-muted-foreground bg-surface-2", Icon: CircleHelp },
  };

/**
 * Confidence is progressive disclosure: the badge is compact, the reasoning
 * lives behind a popover so cards stay uncluttered.
 */
export function ReleaseStatusBadge({
  confidence,
  interactive = true,
  className,
}: {
  confidence: ReleaseConfidence;
  interactive?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const { className: tone, Icon } = CONFIDENCE_STYLES[confidence];
  const label = t(`confidence.${confidence}` as MessageKey);

  const badge = (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold uppercase tracking-[0.12em]",
        tone,
        interactive && "cursor-help",
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {label}
    </span>
  );

  if (!interactive) return badge;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t("confidence.why", { label })}>
          {badge}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 border-border bg-popover text-sm" align="start">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t(`confidence.${confidence}.detail` as MessageKey)}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export function ReleaseKindBadge({ kind }: { kind: ReleaseKind }) {
  const { t } = useI18n();
  if (kind === "full") return null;
  return (
    <span className="inline-flex h-6 items-center rounded-full border border-accent/40 bg-accent-soft px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
      {t(`kind.${kind}` as MessageKey)}
    </span>
  );
}

export function ReleaseStateBadge({
  state,
  delayDays,
}: {
  state: ReleaseState;
  delayDays?: number;
}) {
  const { t } = useI18n();
  if (state === "available") {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
        {t("countdown.availableNow")}
      </span>
    );
  }
  if (state === "delayed" && delayDays) {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive">
        <TriangleAlert aria-hidden className="size-3" />
        {t("countdown.delayed", { n: delayDays })}
      </span>
    );
  }
  return null;
}
