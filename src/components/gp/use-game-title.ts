import { displayTitle } from "@/domain/title";
import { usePreferences } from "@/preferences/PreferencesProvider";

export function useGameTitle(game: { title: string; originalTitle?: string }) {
  const { titleLanguage } = usePreferences();
  return displayTitle(game, titleLanguage);
}
