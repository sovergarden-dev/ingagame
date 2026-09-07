import type { ReactNode } from "react";
import { EmptyState } from "@/components/gp/EmptyState";
import { PanelSkeleton } from "@/components/gp/Skeletons";
import type { ContentFeedResult } from "@/integrations/content/feed";
import { useI18n } from "@/i18n/I18nProvider";

/** Soft empty / error / loading / stale shell for catalogue feeds. */
export function FeedGate({
  isPending,
  isError = false,
  result,
  onRetry,
  showStaleBanner = true,
  children,
}: {
  isPending: boolean;
  isError?: boolean;
  result: ContentFeedResult<unknown> | undefined;
  onRetry: () => void;
  /** Hide the last-good retry strip when a sibling gate already shows it. */
  showStaleBanner?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const items = result?.items ?? [];
  const failed = isError || result?.status === "error";

  if (isPending && items.length === 0) return <PanelSkeleton />;

  if (failed && items.length === 0) {
    return (
      <EmptyState
        title={t("feed.error.title")}
        body={t("feed.error.body")}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"
          >
            {t("feed.error.retry")}
          </button>
        }
      />
    );
  }

  if (!items.length) {
    return <EmptyState title={t("feed.empty.title")} body={t("feed.empty.body")} />;
  }

  return (
    <>
      {failed && showStaleBanner ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          <span>{t("feed.stale.body")}</span>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"
          >
            {t("feed.error.retry")}
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}
