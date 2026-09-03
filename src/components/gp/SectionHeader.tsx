import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  viewAllTo,
  viewAllLabel,
  size = "md",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  viewAllTo?: string;
  viewAllLabel?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="gp-eyebrow mb-1">{eyebrow}</p>}
        <h2
          className={cn(
            "font-semibold text-foreground",
            size === "lg" ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl",
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            {viewAllLabel}
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
