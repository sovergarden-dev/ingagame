import { useEffect, useState } from "react";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { allowViewTransition } from "@/pwa/view-transition";

export function useAllowViewTransition() {
  const { reduceMotion } = usePreferences();
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("startViewTransition" in document);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return allowViewTransition({ reduceMotion, prefersReduced, supported });
}
