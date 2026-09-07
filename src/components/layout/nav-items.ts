import { Compass, Gift, Home, Newspaper, Radar, Star, Tag } from "lucide-react";
import type { MessageKey } from "@/i18n/messages";

export interface NavItem {
  to: string;
  labelKey: MessageKey;
  /** Shorter label for the ≤390px bottom bar when the full label would clip. */
  barLabelKey?: MessageKey;
  Icon: typeof Home;
}

/** Tailwind `md` is 768px; the bottom bar is `md:hidden` (visible through 767px). */
export const MOBILE_BOTTOM_NAV_MAX_PX = 767;
export const MOBILE_NAV_MIN_HIT_PX = 44;

export function showsMobileBottomNav(viewportWidth: number): boolean {
  return viewportWidth <= MOBILE_BOTTOM_NAV_MAX_PX;
}

export function isNavItemActive(itemTo: string, pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (itemTo === "/") return path === "/";
  if (itemTo === "/releases") {
    return path === "/releases" || path === "/radar" || path.startsWith("/releases/");
  }
  return path === itemTo || path.startsWith(`${itemTo}/`);
}

export const MAIN_NAV: NavItem[] = [
  { to: "/", labelKey: "nav.home", Icon: Home },
  { to: "/releases", labelKey: "nav.releases", Icon: Radar },
  { to: "/deals", labelKey: "nav.deals", Icon: Tag },
  { to: "/free", labelKey: "nav.free", Icon: Gift },
  { to: "/news", labelKey: "nav.news", Icon: Newspaper },
  { to: "/discover", labelKey: "nav.discover", Icon: Compass },
  { to: "/watchlist", labelKey: "nav.watchlist", Icon: Star },
];

/** Mobile bottom bar keeps to five reachable destinations. */
export const MOBILE_NAV: NavItem[] = [
  { to: "/", labelKey: "nav.home", Icon: Home },
  { to: "/releases", labelKey: "nav.releases", Icon: Radar },
  { to: "/deals", labelKey: "nav.deals", Icon: Tag },
  { to: "/free", labelKey: "nav.free", barLabelKey: "nav.freeShort", Icon: Gift },
  { to: "/watchlist", labelKey: "nav.watchlist", Icon: Star },
];
