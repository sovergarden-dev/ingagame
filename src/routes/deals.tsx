import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/gp/PlaceholderPage";
import { DealCard } from "@/components/gp/DealCard";
import { DEALS } from "@/domain/mock-data";
import { useI18n } from "@/i18n/I18nProvider";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals — GamePulse" },
      {
        name: "description",
        content: "Track the biggest game discounts across stores, with price history on the way.",
      },
      { property: "og:title", content: "Deals — GamePulse" },
      { property: "og:description", content: "The biggest game discounts across stores." },
    ],
  }),
  component: DealsPage,
});

function DealsPage() {
  const { t, locale } = useI18n();
  return (
    <PlaceholderPage title={t("page.deals.title")} description={t("page.placeholder")}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {DEALS.map((deal) => (
          <DealCard key={deal.id} deal={deal} locale={locale} featured />
        ))}
      </div>
    </PlaceholderPage>
  );
}
