"use client";

import { ArrowLeft, ArrowRight, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Alert, TextField } from "@/components/ui/form-controls";
import { errorMessage } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { useI18n } from "@/i18n/i18n-provider";
import { AuthCard } from "./auth-card";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const { t } = useI18n();
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailChecked, setEmailChecked] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function checkEmail(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await authApi.checkEmail(email);
      if (!result.allowed) {
        setError(t("auth.login.invalidEmail"));
        return;
      }
      setEmailChecked(true);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const sessionUser = await login(email, password);
      router.replace(
        sessionUser?.mustChangePassword
          ? `/change-password?next=${encodeURIComponent(nextPath)}`
          : nextPath,
      );
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
      setSubmitting(false);
    }
  }

  const query = nextPath === "/community" ? "" : `?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthCard
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          {t("auth.login.noAccount")} <Link href={`/register${query}`}>{t("auth.login.goRegister")}</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={emailChecked ? handleSubmit : checkEmail}>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <TextField
          label={t("auth.login.email")}
          name="email"
          type="email"
          icon={Mail}
          autoComplete="email"
          required
          value={email}
          readOnly={emailChecked}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailChecked(false);
            setPassword("");
          }}
        />
        {emailChecked ? (
          <>
            <TextField
              label={t("auth.login.password")}
              name="password"
              type="password"
              icon={Lock}
              autoComplete="current-password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="auth-step-actions">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setEmailChecked(false)}>
                {t("common.cancel")}
              </Button>
              <Link className="auth-link" href="/forgot-password">
                {t("auth.login.forgot")}
              </Link>
            </div>
            <Button type="submit" loading={submitting}>
              {t("auth.login.submit")}
            </Button>
          </>
        ) : (
          <Button type="submit" icon={ArrowRight} loading={submitting}>
            {submitting ? t("auth.login.checkingEmail") : t("auth.login.checkEmail")}
          </Button>
        )}
      </form>
    </AuthCard>
  );
}
