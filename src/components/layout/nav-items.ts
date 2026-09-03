import { Compass, Gift, Home, Newspaper, Radar, Star, Tag } from "lucide-react";
import type { MessageKey } from "@/i18n/messages";

export interface NavItem {
  to: string;
  labelKey: MessageKey;
  Icon: typeof Home;
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
  { to: "/free", labelKey: "nav.free", Icon: Gift },
  { to: "/watchlist", labelKey: "nav.watchlist", Icon: Star },
];
