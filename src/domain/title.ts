/** Catalogue title, or the original-language title when that preference is on and a title exists. */
export function displayTitle(
  game: { title: string; originalTitle?: string },
  mode: "original" | "localized",
): string {
  if (mode === "original") {
    const original = game.originalTitle?.trim();
    if (original) return original;
  }
  return game.title;
}

/** Search matches the catalogue title and the original title when one is recorded. */
export function searchHaystack(game: {
  title: string;
  originalTitle?: string;
  developer?: string;
  publisher?: string;
}) {
  return [game.title, game.originalTitle, game.developer, game.publisher]
    .filter((part) => part && part.trim())
    .join(" ")
    .toLowerCase();
}

export function gameDocumentTitle(shown: string) {
  return `${shown} — Inga`;
}
