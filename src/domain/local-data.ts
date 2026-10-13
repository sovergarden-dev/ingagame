export const LOCAL_DATA_KEYS = [
  "gamepulse.preferences",
  "gamepulse.library",
  "gamepulse.locale",
  "gamepulse.pwa.dismissed",
  "gamepulse.dealAlerts.seen",
  "gamepulse.steam",
  "inga.home-snapshot",
  "inga.releaseAlerts.seen",
  "inga.watchControls",
  "inga.hiddenGames",
  "inga.privateStore",
  "inga.pins",
  "inga.radarFilter",
] as const;

export type LocalDataExport = {
  kind: "inga-local-data";
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
};

/** Copies only keys Inga wrote. Missing keys stay out. Session tokens stay out. */
export function localDataExport(
  read: (key: string) => string | null,
  exportedAt: string,
): LocalDataExport {
  const data: Record<string, string> = {};
  for (const key of LOCAL_DATA_KEYS) {
    const value = read(key);
    if (value !== null) data[key] = value;
  }
  return { kind: "inga-local-data", version: 1, exportedAt, data };
}
