import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlatformId } from "@/domain/types";

export type ThemeMode = "dark" | "light" | "system" | "oled";
export type AccentPreset = "violet" | "cyan" | "ember" | "lime" | "rose";
export type Density = "compact" | "comfortable" | "cinematic";
export type PerformanceMode = "auto" | "eco" | "cinematic";
export type PrivacyMode = "personalized" | "balanced" | "local";
export type TitleLanguage = "original" | "localized";

export interface Preferences {
  theme: ThemeMode;
  accent: AccentPreset;
  /** Architecture for a fully custom accent; unset means "use the preset". */
  customAccent?: string;
  density: Density;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  performance: PerformanceMode;
  spoilerSafe: boolean;
  privacy: PrivacyMode;
  region: string;
  timezone: string;
  currency: string;
  titleLanguage: TitleLanguage;
  myPlatforms: PlatformId[];
  hideOwned: boolean;
}

const DEFAULTS: Preferences = {
  theme: "dark",
  accent: "violet",
  density: "comfortable",
  reduceMotion: false,
  reduceTransparency: false,
  performance: "auto",
  spoilerSafe: false,
  privacy: "balanced",
  region: "VN",
  timezone: "Asia/Ho_Chi_Minh",
  currency: "USD",
  titleLanguage: "original",
  myPlatforms: ["pc", "steam", "playstation", "switch"],
  hideOwned: false,
};

interface PreferencesValue extends Preferences {
  set: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);
const STORAGE_KEY = "gamepulse.preferences";

function resolveTheme(theme: ThemeMode): "dark" | "light" | "oled" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  // Read persisted prefs after hydration so SSR and first client render match.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) });
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const resolved = resolveTheme(prefs.theme);
    root.dataset["theme"] = resolved;
    root.classList.toggle("dark", resolved !== "light");
    root.dataset["accent"] = prefs.accent;
    root.dataset["density"] = prefs.density;
    root.dataset["perf"] = prefs.performance;
    root.dataset["reduceMotion"] = String(prefs.reduceMotion);
    root.dataset["reduceTransparency"] = String(prefs.reduceTransparency);
    if (prefs.customAccent) root.style.setProperty("--accent", prefs.customAccent);
    else root.style.removeProperty("--accent");
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage may be unavailable */
    }
  }, [prefs]);

  const set = useCallback<PreferencesValue["set"]>((key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setPrefs(DEFAULTS), []);

  const value = useMemo(() => ({ ...prefs, set, reset }), [prefs, set, reset]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
