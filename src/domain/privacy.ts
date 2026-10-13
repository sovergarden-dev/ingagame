import type { PrivacyMode } from "@/preferences/PreferencesProvider";

/** Local-first keeps the watchlist on this device and does not upload it. */
export function allowsCloudSync(privacy: PrivacyMode) {
  return privacy !== "local";
}
