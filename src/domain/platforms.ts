import type { Platform, PlatformId } from "./types";

export const PLATFORMS: Record<PlatformId, Platform> = {
  pc: { id: "pc", name: "PC", family: "pc", shortLabel: "PC" },
  steam: { id: "steam", name: "Steam", family: "pc", shortLabel: "STM" },
  epic: { id: "epic", name: "Epic Games Store", family: "pc", shortLabel: "EGS" },
  playstation: {
    id: "playstation",
    name: "PlayStation 5",
    family: "playstation",
    shortLabel: "PS5",
  },
  xbox: { id: "xbox", name: "Xbox Series X|S", family: "xbox", shortLabel: "XSX" },
  switch: { id: "switch", name: "Nintendo Switch", family: "nintendo", shortLabel: "NSW" },
  switch2: { id: "switch2", name: "Nintendo Switch 2", family: "nintendo", shortLabel: "NS2" },
  mobile: { id: "mobile", name: "Mobile", family: "mobile", shortLabel: "MOB" },
  vr: { id: "vr", name: "VR", family: "vr", shortLabel: "VR" },
};

export const PLATFORM_LIST: Platform[] = Object.values(PLATFORMS);

export type PlatformFilterId =
  "all" | "mine" | "pc" | "playstation" | "xbox" | "nintendo" | "mobile" | "vr";

export const PLATFORM_FILTERS: { id: PlatformFilterId; labelKey: string }[] = [
  { id: "all", labelKey: "filter.all" },
  { id: "mine", labelKey: "filter.myPlatforms" },
  { id: "pc", labelKey: "platform.pc" },
  { id: "playstation", labelKey: "platform.playstation" },
  { id: "xbox", labelKey: "platform.xbox" },
  { id: "nintendo", labelKey: "platform.nintendo" },
  { id: "mobile", labelKey: "platform.mobile" },
  { id: "vr", labelKey: "platform.vr" },
];

export function isPlatformFilterId(value: string | null): value is PlatformFilterId {
  return PLATFORM_FILTERS.some((filter) => filter.id === value);
}

/** Family words that are not store brands. Store names stay as published. */
export function platformMessageKey(
  id: PlatformId,
): "platform.pc" | "platform.mobile" | "platform.vr" | null {
  if (id === "pc" || id === "mobile" || id === "vr") return `platform.${id}`;
  return null;
}

export function matchesPlatformFilter(
  platforms: PlatformId[],
  filter: PlatformFilterId,
  myPlatforms: PlatformId[],
): boolean {
  if (filter === "all") return true;
  if (filter === "mine") return platforms.some((p) => myPlatforms.includes(p));
  return platforms.some((p) => PLATFORMS[p]?.family === filter);
}
