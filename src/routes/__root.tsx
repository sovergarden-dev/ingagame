import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider, useI18n } from "@/i18n/I18nProvider";
import { PreferencesProvider } from "@/preferences/PreferencesProvider";
import { LibraryProvider } from "@/library/LibraryProvider";
import { AuthProvider } from "@/auth/AuthProvider";
import { PrivateDataGate } from "@/privacy/PrivateDataGate";
import { APP_NAME } from "@/domain/brand";

import { SteamProvider } from "@/integrations/steam/SteamProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/gp/InstallPrompt";
import { WatchControlsProvider } from "@/watch/WatchControlsProvider";
import { HiddenGamesProvider } from "@/discover/HiddenGamesProvider";
import { PinsProvider } from "@/pins/PinsProvider";
import { DealAlertsProvider } from "@/deals/deal-alerts";
import { ReleaseChangeAlerts } from "@/releases/change-alerts";

function NotFoundComponent() {
  const { t } = useI18n();
  useEffect(() => {
    document.title = `${t("error.notFound.title")} — ${t("app.name")}`;
  }, [t]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("error.notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.notFound.body")}</p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.notFound.home")}
          </a>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <I18nProvider>
      <ErrorScreen reset={reset} />
    </I18nProvider>
  );
}

function ErrorScreen({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  useEffect(() => {
    document.title = `${t("error.load.title")} — ${t("app.name")}`;
  }, [t]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("error.load.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.load.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.retry")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("error.home")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: APP_NAME },
      { name: "theme-color", content: "#0b0b0f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },

      { property: "og:type", content: "website" },
      { property: "og:site_name", content: APP_NAME },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@500;600&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/pwa-icon-192.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="dark"
      data-theme="dark"
      data-accent="violet"
      data-density="comfortable"
    >
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    const removeBadge = () => {
      document
        .querySelectorAll("#lovable-badge, [id^='lovable-badge']")
        .forEach((el) => el.remove());
    };
    removeBadge();
    const observer = new MutationObserver(removeBadge);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timeout = window.setTimeout(removeBadge, 4000);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <I18nProvider>
          <AuthProvider>
            <PrivateDataGate>
              <LibraryProvider>
                <SteamProvider>
                  <WatchControlsProvider>
                    <HiddenGamesProvider>
                      <PinsProvider>
                        <DealAlertsProvider>
                          <ReleaseChangeAlerts>
                            <AppShell>
                              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                              <Outlet />
                            </AppShell>
                          </ReleaseChangeAlerts>
                          <InstallPrompt />
                          <Toaster />
                        </DealAlertsProvider>
                      </PinsProvider>
                    </HiddenGamesProvider>
                  </WatchControlsProvider>
                </SteamProvider>
              </LibraryProvider>
            </PrivateDataGate>
          </AuthProvider>
        </I18nProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
