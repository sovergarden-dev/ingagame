export function trackedReleaseChanges<
  T extends { game: { id: string }; event: { id: string; previousDate?: string } },
>(entries: T[], trackedIds: ReadonlySet<string>): T[] {
  const seen = new Set<string>();
  const changes: T[] = [];
  for (const entry of entries) {
    if (!trackedIds.has(entry.game.id) || !entry.event.previousDate) continue;
    if (seen.has(entry.event.id)) continue;
    seen.add(entry.event.id);
    changes.push(entry);
  }
  return changes;
}
