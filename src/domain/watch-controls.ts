export type WatchControls = {
  paused: boolean;
  mutedGameIds: string[];
};

export const EMPTY_WATCH_CONTROLS: WatchControls = {
  paused: false,
  mutedGameIds: [],
};

/** Paused or muted alerts stay unseen so they can still arrive after the user turns them back on. */
export function shouldDeliverAlert(controls: WatchControls, gameId: string | undefined): boolean {
  if (controls.paused) return false;
  if (gameId && controls.mutedGameIds.includes(gameId)) return false;
  return true;
}

export function toggleMutedGame(controls: WatchControls, gameId: string): WatchControls {
  const mutedGameIds = controls.mutedGameIds.includes(gameId)
    ? controls.mutedGameIds.filter((id) => id !== gameId)
    : [...controls.mutedGameIds, gameId];
  return { ...controls, mutedGameIds };
}
