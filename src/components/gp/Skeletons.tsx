import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ReleaseCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("w-[148px] shrink-0 space-y-2", className)}>
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
  );
}

export function ReleaseRailSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <ReleaseCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="gp-panel space-y-3 p-4" aria-hidden>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="gp-panel aspect-[21/9] w-full overflow-hidden" aria-hidden>
      <Skeleton className="size-full" />
    </div>
  );
}
