import { Star } from "lucide-react";
import { useLibrary } from "@/library/LibraryProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

export function WishlistButton({
  gameId,
  className,
  variant = "icon",
}: {
  gameId: string;
  className?: string;
  variant?: "icon" | "full";
}) {
  const { isWishlisted, toggleWishlist } = useLibrary();
  const { t } = useI18n();
  const active = isWishlisted(gameId);
  const label = active ? t("action.wishlisted") : t("action.wishlist");

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={() => toggleWishlist(gameId)}
        aria-pressed={active}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
          active
            ? "bg-accent text-accent-foreground gp-glow"
            : "gp-glass text-foreground hover:border-accent/60",
          className,
        )}
      >
        <Star aria-hidden className={cn("size-4", active && "fill-current")} />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWishlist(gameId);
      }}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg border transition-colors",
        active
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border-strong bg-background/70 text-foreground/80 backdrop-blur hover:border-accent hover:text-accent",
        className,
      )}
    >
      <Star aria-hidden className={cn("size-4", active && "fill-current")} />
    </button>
  );
}
