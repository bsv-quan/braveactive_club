"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, TextField } from "@/components/ui/form-controls";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/client";
import { useI18n } from "@/i18n/i18n-provider";
import { AuthCard } from "./auth-card";

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    } finally {
      setSubmitting(false);
    }
  }

  const loginLink = (
    <Link className="ui-button ui-button-primary" href="/login">
      {t("auth.reset.goLogin")}
    </Link>
  );

  return (
    <AuthCard title={t("auth.reset.title")} subtitle={t("auth.reset.subtitle")}>
      {!token ? (
        <div className="auth-form">
          <Alert tone="error">{t("auth.reset.missingToken")}</Alert>
          <Link href="/forgot-password">{t("auth.forgot.title")}</Link>
        </div>
      ) : done ? (
        <div className="auth-form">
          <Alert tone="success">{t("auth.reset.done")}</Alert>
          {loginLink}
        </div>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <TextField
            label={t("auth.reset.password")}
            name="password"
            type="password"
            icon={Lock}
            autoComplete="new-password"
            minLength={8}
            required
            hint={t("auth.change.passwordHint")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" loading={submitting}>
            {t("auth.reset.submit")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
