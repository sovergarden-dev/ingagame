export function togglePin(ids: string[], gameId: string) {
  return ids.includes(gameId) ? ids.filter((id) => id !== gameId) : [...ids, gameId];
}

export function pinnedGames<T extends { id: string }>(ids: string[], games: T[]) {
  const byId = new Map(games.map((game) => [game.id, game]));
  return ids.flatMap((id) => {
    const game = byId.get(id);
    return game ? [game] : [];
  });
}
