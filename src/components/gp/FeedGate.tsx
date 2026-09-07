import type { ReactNode } from "react";
import { EmptyState } from "@/components/gp/EmptyState";
import { PanelSkeleton } from "@/components/gp/Skeletons";
import type { ContentFeedResult } from "@/integrations/content/feed";
import { useI18n } from "@/i18n/I18nProvider";

/** Soft empty / error / loading shell for catalogue feeds. */
export function FeedGate({
  isPending,
  result,
  onRetry,
  children,
}: {
  isPending: boolean;
  result: ContentFeedResult<unknown> | undefined;
  onRetry: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();

  if (isPending) return <PanelSkeleton />;

  if (result?.status === "error" && result.items.length === 0) {
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

  if (!result?.items.length) {
    return <EmptyState title={t("feed.empty.title")} body={t("feed.empty.body")} />;
  }

  return children;
}
