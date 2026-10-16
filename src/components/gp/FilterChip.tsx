import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Toggleable pill used by list filters across routes. */
export function FilterChip({
  active,
  onClick,
  disabled = false,
  title,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean | undefined;
  title?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "inline-flex h-11 items-center rounded-full border px-3 text-xs font-medium transition-colors sm:h-7 sm:px-2.5 sm:text-[11px]",
        disabled
          ? "cursor-not-allowed border-border/50 text-muted-foreground/50 opacity-60"
          : active
            ? "border-accent bg-accent-soft text-accent"
            : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Single-choice segmented control (sort orders, tabs). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; Icon?: React.ComponentType<{ className?: string }> }[];
  onChange: (next: T) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap items-center gap-1">
      {options.map(({ id, label: optionLabel, Icon }) => (
        <button
          key={id}
          role="tab"
          type="button"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors sm:h-8",
            value === id
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          )}
        >
          {Icon && <Icon aria-hidden className="size-3.5" />}
          {optionLabel}
        </button>
      ))}
    </div>
  );
}
