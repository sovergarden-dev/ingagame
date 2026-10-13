import { useCallback, useEffect, useState } from "react";
import { shouldOfferSwUpdate } from "@/pwa/sw-update";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "gamepulse.pwa.dismissed";

/** Tracks PWA installability, registers the service worker and exposes the install prompt. */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      if (import.meta.env.PROD) {
        void navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            const offer = () => {
              const hasController = Boolean(navigator.serviceWorker.controller);
              const hasWaitingWorker = Boolean(registration.waiting);
              if (!hasController && hasWaitingWorker) {
                registration.waiting?.postMessage({ type: "SKIP_WAITING" });
              }
              setUpdateReady(shouldOfferSwUpdate({ hasController, hasWaitingWorker }));
            };
            offer();
            registration.addEventListener("updatefound", () => {
              registration.installing?.addEventListener("statechange", offer);
            });
          })
          .catch(() => undefined);
      } else {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((r) => void r.unregister()))
          .catch(() => undefined);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome;
  }, [deferred]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  const applyUpdate = useCallback(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });
    void navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  }, []);

  return {
    canInstall: Boolean(deferred) && !installed,
    installed,
    dismissed,
    updateReady,
    install,
    dismiss,
    applyUpdate,
  };
}
