import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/gp/SectionHeader";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/auth/AuthProvider";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — GamePulse" },
      {
        name: "description",
        content: "Sign in to GamePulse to sync your wishlist, followed games and release alerts.",
      },
      { property: "og:title", content: "Sign in — GamePulse" },
      { property: "og:description", content: "Sync your watchlist across devices." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) void navigate({ to: "/watchlist" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const err = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    if (err) setError(err);
    else if (mode === "up") setMessage(t("auth.checkEmail"));
    setBusy(false);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 py-6">
      <SectionHeader
        eyebrow={t("app.tagline")}
        title={t("auth.title")}
        description={t("auth.subtitle")}
        size="lg"
      />

      <form onSubmit={submit} className="gp-panel space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? t("auth.working") : mode === "in" ? t("auth.signIn") : t("auth.signUp")}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const err = await signInWithGoogle();
            if (err) setError(err);
            setBusy(false);
          }}
        >
          {t("auth.google")}
        </Button>

        <button
          type="button"
          className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? t("auth.toggleToSignUp") : t("auth.toggleToSignIn")}
        </button>
      </form>
    </div>
  );
}
