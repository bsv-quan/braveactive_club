"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Alert, TextField } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api/client";
import { safeNextPath } from "@/lib/safe-redirect";
import { useI18n } from "@/i18n/i18n-provider";

export function ChangePasswordForm({ nextPath }: { nextPath: string }) {
  const { t } = useI18n();
  const { changePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await changePassword(password);
      router.replace(safeNextPath(nextPath));
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card">
      <h1>{t("auth.change.title")}</h1>
      <p className="auth-subtitle">{t("auth.change.subtitle")}</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <TextField
          label={t("auth.change.password")}
          name="newPassword"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          minLength={8}
          required
          hint={t("auth.change.passwordHint")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" loading={submitting}>
          {t("auth.change.submit")}
        </Button>
        <Link className="auth-link" href="/forgot-password">
          {t("auth.login.forgot")}
        </Link>
      </form>
    </section>
  );
}
