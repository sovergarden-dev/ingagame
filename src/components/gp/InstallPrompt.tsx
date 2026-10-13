import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { usePwaInstall } from "@/pwa/usePwaInstall";

/** Non-blocking install card — only shows when the browser offers a real prompt. */
export function InstallPrompt() {
  const { t } = useI18n();
  const { canInstall, dismissed, install, dismiss, updateReady, applyUpdate } = usePwaInstall();

  if (updateReady) {
    return (
      <div
        role="dialog"
        aria-label={t("pwa.update")}
        className="gp-panel fixed bottom-20 left-1/2 z-50 w-[min(26rem,calc(100vw-1.5rem))] -translate-x-1/2 p-4 shadow-lg md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
      >
        <p className="font-display text-sm font-bold text-foreground">{t("pwa.update")}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("pwa.updateBody")}</p>
        <div className="mt-3">
          <Button size="sm" onClick={applyUpdate}>
            {t("pwa.reload")}
          </Button>
        </div>
      </div>
    );
  }

  if (!canInstall || dismissed) return null;

  return (
    <div
      role="dialog"
      aria-label={t("pwa.title")}
      className="gp-panel fixed bottom-20 left-1/2 z-50 w-[min(26rem,calc(100vw-1.5rem))] -translate-x-1/2 p-4 shadow-lg md:bottom-6 md:left-auto md:right-6 md:translate-x-0"
    >
      <button
        type="button"
        aria-label={t("pwa.later")}
        onClick={dismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X aria-hidden className="size-4" />
      </button>
      <p className="font-display text-sm font-bold text-foreground">{t("pwa.title")}</p>
      <p className="mt-1 pr-4 text-xs leading-relaxed text-muted-foreground">{t("pwa.body")}</p>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={() => void install()}>
          <Download aria-hidden className="size-4" />
          {t("pwa.install")}
        </Button>
        <Button size="sm" variant="quiet" onClick={dismiss}>
          {t("pwa.later")}
        </Button>
      </div>
    </div>
  );
}
