import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";
import { FreshnessStatus } from "./FreshnessStatus";
import type { FreshnessStatus as FreshnessStatusType } from "@/domain/types";
import { useI18n } from "@/i18n/I18nProvider";

/** Standard route shell: eyebrow + title + description, freshness badge, toolbar slot. */
export function PageShell({
  title,
  description,
  toolbar,
  freshness = { state: "fresh", minutesAgo: 0 },
  children,
}: {
  title: string;
  description?: string;
  toolbar?: ReactNode;
  freshness?: FreshnessStatusType;
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
        <FreshnessStatus status={freshness} />
      </div>
      {toolbar && <div className="gp-panel flex flex-wrap items-center gap-4 p-3">{toolbar}</div>}
      {children}
    </div>
  );
}
