import { Gamepad2, Headset, Monitor, Smartphone } from "lucide-react";
import { PLATFORMS } from "@/domain/platforms";
import type { PlatformId } from "@/domain/types";
import { cn } from "@/lib/utils";

const ICONS = {
  pc: Monitor,
  playstation: Gamepad2,
  xbox: Gamepad2,
  nintendo: Gamepad2,
  mobile: Smartphone,
  vr: Headset,
} as const;

export function PlatformBadge({
  platform,
  size = "sm",
  showLabel = false,
  className,
}: {
  platform: PlatformId;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const meta = PLATFORMS[platform];
  if (!meta) return null;
  const Icon = ICONS[meta.family];
  return (
    <span
      title={meta.name}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/70 font-medium text-muted-foreground",
        size === "xs" && "h-5 px-1.5 text-[10px]",
        size === "sm" && "h-6 px-2 text-[11px]",
        size === "md" && "h-8 px-3 text-xs",
        className,
      )}
    >
      <Icon aria-hidden className={size === "md" ? "size-4" : "size-3"} />
      <span className={showLabel ? "" : "sr-only"}>{meta.name}</span>
      {!showLabel && <span aria-hidden>{meta.shortLabel}</span>}
    </span>
  );
}

export function PlatformBadgeList({
  platforms,
  max = 3,
  size = "xs",
  className,
}: {
  platforms: PlatformId[];
  max?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const shown = platforms.slice(0, max);
  const rest = platforms.length - shown.length;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((p) => (
        <PlatformBadge key={p} platform={p} size={size} />
      ))}
      {rest > 0 && <span className="text-[10px] font-medium text-muted-foreground">+{rest}</span>}
    </div>
  );
}
