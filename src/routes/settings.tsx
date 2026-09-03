import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOCALES, type LocaleCode } from "@/i18n/locales";
import { useI18n } from "@/i18n/I18nProvider";
import { PLATFORMS } from "@/domain/platforms";
import {
  usePreferences,
  type AccentPreset,
  type Density,
  type PerformanceMode,
  type PrivacyMode,
  type ThemeMode,
  type TitleLanguage,
} from "@/preferences/PreferencesProvider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — GamePulse" },
      {
        name: "description",
        content:
          "Tune theme, accent, density, motion, performance mode, privacy and localization for GamePulse.",
      },
      { property: "og:title", content: "Settings — GamePulse" },
      { property: "og:description", content: "Theme, density, performance, privacy and language." },
    ],
  }),
  component: SettingsPage,
});

const ACCENTS: { id: AccentPreset; swatch: string }[] = [
  { id: "violet", swatch: "oklch(0.66 0.22 300)" },
  { id: "cyan", swatch: "oklch(0.72 0.14 214)" },
  { id: "ember", swatch: "oklch(0.7 0.18 45)" },
  { id: "lime", swatch: "oklch(0.78 0.18 140)" },
  { id: "rose", swatch: "oklch(0.66 0.2 12)" },
];

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="gp-panel p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-2/60 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-8 rounded-md px-3 text-xs font-medium transition-colors",
            value === o.id
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const prefs = usePreferences();

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow={t("app.tagline")} title={t("settings.title")} size="lg" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("settings.appearance")}>
          <Row label={t("settings.theme")}>
            <Segmented<ThemeMode>
              value={prefs.theme}
              onChange={(v) => prefs.set("theme", v)}
              options={[
                { id: "dark", label: t("settings.theme.dark") },
                { id: "light", label: t("settings.theme.light") },
                { id: "system", label: t("settings.theme.system") },
                { id: "oled", label: t("settings.theme.oled") },
              ]}
            />
          </Row>

          <Row label={t("settings.accent")}>
            <div className="flex items-center gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-label={a.id}
                  aria-pressed={prefs.accent === a.id}
                  onClick={() => prefs.set("accent", a.id)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform",
                    prefs.accent === a.id
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: a.swatch }}
                />
              ))}
            </div>
          </Row>

          <Row label={t("settings.density")}>
            <Segmented<Density>
              value={prefs.density}
              onChange={(v) => prefs.set("density", v)}
              options={[
                { id: "compact", label: t("settings.density.compact") },
                { id: "comfortable", label: t("settings.density.comfortable") },
                { id: "cinematic", label: t("settings.density.cinematic") },
              ]}
            />
          </Row>

          <Row label={t("settings.motion")}>
            <Switch
              checked={prefs.reduceMotion}
              onCheckedChange={(v) => prefs.set("reduceMotion", v)}
              aria-label={t("settings.motion")}
            />
          </Row>

          <Row label={t("settings.transparency")}>
            <Switch
              checked={prefs.reduceTransparency}
              onCheckedChange={(v) => prefs.set("reduceTransparency", v)}
              aria-label={t("settings.transparency")}
            />
          </Row>
        </Panel>

        <Panel title={t("settings.performance")}>
          <Row label={t("settings.performance")}>
            <Segmented<PerformanceMode>
              value={prefs.performance}
              onChange={(v) => prefs.set("performance", v)}
              options={[
                { id: "auto", label: t("settings.performance.auto") },
                { id: "eco", label: t("settings.performance.eco") },
                { id: "cinematic", label: t("settings.performance.cinematic") },
              ]}
            />
          </Row>

          <Row label={t("settings.spoiler")}>
            <Switch
              checked={prefs.spoilerSafe}
              onCheckedChange={(v) => prefs.set("spoilerSafe", v)}
              aria-label={t("settings.spoiler")}
            />
          </Row>

          <Row label={t("settings.privacy")}>
            <Segmented<PrivacyMode>
              value={prefs.privacy}
              onChange={(v) => prefs.set("privacy", v)}
              options={[
                { id: "personalized", label: t("settings.privacy.personalized") },
                { id: "balanced", label: t("settings.privacy.balanced") },
                { id: "local", label: t("settings.privacy.local") },
              ]}
            />
          </Row>
        </Panel>

        <Panel title={t("settings.localization")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ui-language">{t("settings.uiLanguage")}</Label>
              <Select value={locale} onValueChange={(v) => setLocale(v as LocaleCode)}>
                <SelectTrigger id="ui-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.native}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="region">{t("settings.region")}</Label>
              <Input
                id="region"
                value={prefs.region}
                onChange={(e) => prefs.set("region", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone">{t("settings.timezone")}</Label>
              <Input
                id="timezone"
                value={prefs.timezone}
                onChange={(e) => prefs.set("timezone", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currency">{t("settings.currency")}</Label>
              <Input
                id="currency"
                value={prefs.currency}
                onChange={(e) => prefs.set("currency", e.target.value)}
              />
            </div>
          </div>

          <Row label={t("settings.titleLanguage")}>
            <Segmented<TitleLanguage>
              value={prefs.titleLanguage}
              onChange={(v) => prefs.set("titleLanguage", v)}
              options={[
                { id: "original", label: t("settings.titleLanguage.original") },
                { id: "localized", label: t("settings.titleLanguage.localized") },
              ]}
            />
          </Row>
        </Panel>

        <Panel title={t("topbar.platforms")}>
          <p className="text-sm text-muted-foreground">{t("page.placeholder")}</p>
          <ul className="flex flex-wrap gap-2">
            {prefs.myPlatforms.map((p) => (
              <li
                key={p}
                className="rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
              >
                {PLATFORMS[p].name}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
