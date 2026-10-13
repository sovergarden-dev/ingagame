import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";
import { useLibrary } from "@/library/LibraryProvider";
import { allowsCloudSync } from "@/domain/privacy";
import { usePreferences } from "@/preferences/PreferencesProvider";

/** Account state for Settings: sign in, sync status, sign out. */
export function AccountPanel() {
  const { t } = useI18n();
  const { user, signOut } = useAuth();
  const { synced, loading } = useLibrary();
  const { privacy } = usePreferences();
  const cloud = allowsCloudSync(privacy);

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {cloud ? t("auth.localOnly") : t("auth.cloudOff")}
        </p>
        {cloud ? (
          <Button asChild size="sm">
            <Link to="/auth">{t("auth.signIn")}</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        {t("auth.signedInAs", { email: user.email ?? user.id })}
      </p>
      <p className="text-xs text-muted-foreground">
        {loading ? t("auth.syncing") : synced ? t("auth.synced") : t("auth.cloudOff")}
      </p>
      <Button size="sm" variant="outline" onClick={() => void signOut()}>
        {t("auth.signOut")}
      </Button>
    </div>
  );
}
