import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Globe,
  Layers,
  Menu,
  Search,
  Settings,
  User,
} from "lucide-react";
import { MAIN_NAV, MOBILE_NAV } from "./nav-items";
import { Logo } from "./Logo";
import { CommandCenter } from "@/components/gp/CommandCenter";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALES, type LocaleCode } from "@/i18n/locales";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { PLATFORM_LIST } from "@/domain/platforms";
import type { PlatformId } from "@/domain/types";
import { cn } from "@/lib/utils";

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav aria-label={t("nav.primary")} className="flex flex-col gap-1">
      {MAIN_NAV.map(({ to, labelKey, Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to as never}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? t(labelKey) : undefined}
            className={cn(
              "group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-accent-soft text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
            )}
          >
            <span className="relative flex items-center">
              {active && !collapsed && (
                <span
                  aria-hidden
                  className="absolute -left-3 h-5 w-0.5 rounded-full bg-accent"
                />
              )}
              <Icon aria-hidden className={cn("size-4.5", active && "text-accent")} />
            </span>
            {!collapsed && <span className="truncate">{t(labelKey)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();
  return (
    <div className="space-y-1 border-t border-sidebar-border pt-3">
      <Link
        to="/settings"
        className={cn(
          "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Settings aria-hidden className="size-4.5" />
        {!collapsed && t("nav.settings")}
      </Link>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground">
          <User aria-hidden className="size-4" />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {t("nav.profile")}
            </span>
            <span className="block truncate text-xs text-muted-foreground">Signed out</span>
          </span>
        )}
      </div>
    </div>
  );
}

function LanguageMenu() {
  const { t, locale, setLocale } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="sm" aria-label={t("topbar.language")}>
          <Globe />
          <span className="hidden uppercase sm:inline">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("topbar.language")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(v) => setLocale(v as LocaleCode)}
        >
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l.code} value={l.code}>
              {l.native}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlatformsMenu() {
  const { t } = useI18n();
  const { myPlatforms, set } = usePreferences();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="sm">
          <Layers />
          <span className="hidden lg:inline">{t("topbar.platforms")}</span>
          <span className="rounded bg-accent-soft px-1.5 text-[11px] font-semibold text-accent">
            {myPlatforms.length}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("topbar.platforms")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PLATFORM_LIST.map((p) => (
          <DropdownMenuCheckboxItem
            key={p.id}
            checked={myPlatforms.includes(p.id)}
            onCheckedChange={(checked) =>
              set(
                "myPlatforms",
                checked
                  ? [...myPlatforms, p.id]
                  : myPlatforms.filter((x: PlatformId) => x !== p.id),
              )
            }
          >
            {p.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      <CommandCenter open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar p-3 transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className={cn("mb-5 flex items-center", collapsed ? "justify-center" : "px-1")}>
          <Link to="/" className="min-w-0">
            <Logo compact={collapsed} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList collapsed={collapsed} />
        </div>
        <SidebarFooter collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          className="absolute -right-3 top-16 flex size-6 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {collapsed ? (
            <ChevronRight aria-hidden className="size-3.5" />
          ) : (
            <ChevronLeft aria-hidden className="size-3.5" />
          )}
        </button>
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "md:pl-[76px]" : "md:pl-[248px]")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border gp-glass">
          <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-5">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("nav.menu")}>
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[264px] border-sidebar-border bg-sidebar p-4">
                <SheetTitle className="sr-only">{t("nav.primary")}</SheetTitle>
                <Link to="/" onClick={() => setMobileNavOpen(false)} className="mb-5 block">
                  <Logo />
                </Link>
                <NavList collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
                <div className="mt-4">
                  <SidebarFooter collapsed={false} />
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="md:hidden">
              <Logo compact />
            </Link>

            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label={t("search.hint")}
              className="ml-auto flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 text-left text-sm text-muted-foreground transition-colors hover:border-accent/60 md:ml-0 md:max-w-xl"
            >
              <Search aria-hidden className="size-4 shrink-0" />
              <span className="truncate max-sm:sr-only">{t("search.placeholder")}</span>
              <kbd className="ml-auto hidden shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:flex">
                Ctrl K
              </kbd>
            </button>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="hidden sm:block">
                <LanguageMenu />
              </span>
              <span className="hidden sm:block">
                <PlatformsMenu />
              </span>
              <Button variant="ghost" size="icon" aria-label={t("topbar.notifications")} className="relative">
                <Bell />
                <span aria-hidden className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />
              </Button>
              <Link
                to="/settings"
                aria-label={t("nav.settings")}
                className="flex size-9 items-center justify-center rounded-full border border-border bg-surface-2 text-muted-foreground transition-colors hover:border-accent hover:text-accent"
              >
                <User aria-hidden className="size-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1800px] px-3 pb-28 pt-4 sm:px-5 sm:pt-6 md:pb-12">
          {children}
        </main>

        <footer className="hidden border-t border-border px-5 py-6 text-center md:block">
          <p className="font-display text-[11px] uppercase tracking-[0.36em] text-muted-foreground">
            {t("app.motto")}
          </p>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label={t("nav.primary")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border gp-glass pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map(({ to, labelKey, Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <li key={to}>
                <Link
                  to={to as never}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors",
                    active ? "text-accent" : "text-muted-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                  <span className="truncate">{t(labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
