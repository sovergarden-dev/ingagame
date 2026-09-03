import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";
import { EmptyState } from "./EmptyState";
import { FreshnessStatus } from "./FreshnessStatus";
import { useI18n } from "@/i18n/I18nProvider";

/** Lightweight route shell for surfaces that land in a later pass. */
export function PlaceholderPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          eyebrow={t("app.tagline")}
          title={title}
          {...(description ? { description } : {})}
          size="lg"
        />
        <FreshnessStatus status={{ state: "fresh", minutesAgo: 0 }} />
      </div>
      {children ?? <EmptyState title={title} body={t("page.placeholder")} />}
    </div>
  );
}
