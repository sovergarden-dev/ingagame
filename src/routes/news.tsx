import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/gp/PlaceholderPage";
import { ARTICLES } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Gaming News & Official Updates — GamePulse" },
      {
        name: "description",
        content: "Release announcements, delays and official patch notes, filtered to what you follow.",
      },
      { property: "og:title", content: "Gaming News & Official Updates — GamePulse" },
      { property: "og:description", content: "Announcements, delays and official updates." },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { t, locale } = useI18n();
  return (
    <PlaceholderPage title={t("page.news.title")} description={t("page.placeholder")}>
      <ul className="gp-panel divide-y divide-border p-4">
        {ARTICLES.map((a) => (
          <li key={a.id} className="py-3">
            <p className="text-sm font-medium leading-snug text-foreground">{a.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {a.source} ·{" "}
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(a.publishedAt),
              )}
            </p>
          </li>
        ))}
      </ul>
    </PlaceholderPage>
  );
}
