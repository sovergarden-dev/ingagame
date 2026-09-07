import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gamepad2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSteam } from "@/integrations/steam/SteamProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { getGame } from "@/domain/mock-data";
import type { MessageKey } from "@/i18n/messages";

function hours(minutes: number) {
  return Math.round(minutes / 60);
}

export function SteamPanel() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { status, snapshot, errorCode, mock, connect, resync, disconnect } = useSteam();
  const [handle, setHandle] = useState("");
  const busy = status === "connecting";

  const errorKey = (
    errorCode === "profile-private"
      ? "steam.error.private"
      : errorCode === "handle-too-short"
        ? "steam.error.short"
        : errorCode === "sign-in-required"
          ? "steam.error.signIn"
          : errorCode === "start-failed" || errorCode === "start_failed"
            ? "steam.error.start"
            : errorCode === "library-sync-stub"
              ? "steam.syncStub"
              : "steam.error.unknown"
  ) satisfies MessageKey;

  if (status === "connected" && snapshot) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {snapshot.profile.avatarUrl ? (
            <img
              src={snapshot.profile.avatarUrl}
              alt=""
              width={96}
              height={96}
              loading="lazy"
              className="size-12 rounded-lg border border-border object-cover"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-lg border border-border bg-surface-2">
              <Gamepad2 className="size-5 text-muted-foreground" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {snapshot.profile.personaName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {snapshot.profile.steamId}
              {snapshot.ownedGames.length > 0
                ? ` · ${snapshot.ownedGames.length} ${t("steam.games")}`
                : null}
            </p>
          </div>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
            {t("steam.connected")}
          </span>
        </div>

        {snapshot.ownedGames.length > 0 ? (
          <ul className="space-y-1">
            {snapshot.ownedGames.map((owned) => {
              const game = getGame(owned.gameId);
              if (!game) return null;
              return (
                <li key={owned.gameId}>
                  <Link
                    to="/game/$slug"
                    params={{ slug: game.slug }}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border hover:bg-surface-2/70"
                  >
                    <img
                      src={game.coverUrl}
                      alt=""
                      width={600}
                      height={900}
                      loading="lazy"
                      className="size-9 shrink-0 rounded-md border border-border object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {game.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {hours(owned.playtimeMinutes)}h
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="glass" size="sm" onClick={() => void resync()} disabled={busy}>
            <RefreshCw />
            {t("steam.resync")}
          </Button>
          <Button variant="quiet" size="sm" onClick={disconnect}>
            <Unplug />
            {t("steam.disconnect")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mock ? t("steam.mockNote") : t("steam.syncStub")}
        </p>
      </div>
    );
  }

  if (!mock) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("steam.bodyServer")}</p>
        {status === "error" ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {t(errorKey)}
          </p>
        ) : null}
        {user ? (
          <>
            <Button type="button" disabled={busy} onClick={() => void connect()}>
              {busy ? <Loader2 className="animate-spin" /> : <Gamepad2 />}
              {busy ? t("steam.connecting") : t("steam.connect")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("steam.redirectNote")}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{t("steam.signInFirst")}</p>
            <Button asChild size="sm">
              <Link to="/auth">{t("auth.signIn")}</Link>
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void connect(handle);
      }}
    >
      <p className="text-sm text-muted-foreground">{t("steam.body")}</p>
      <div className="space-y-1.5">
        <Label htmlFor="steam-handle">{t("steam.handle")}</Label>
        <Input
          id="steam-handle"
          value={handle}
          placeholder="yourhandle"
          onChange={(e) => setHandle(e.target.value)}
          disabled={busy}
        />
      </div>
      {status === "error" ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {t(errorKey)}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || handle.trim().length === 0}>
        {busy ? <Loader2 className="animate-spin" /> : <Gamepad2 />}
        {busy ? t("steam.connecting") : t("steam.connect")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("steam.mockNote")}</p>
    </form>
  );
}
