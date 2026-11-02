"use client";

import { ArrowLeft, ArrowRight, Mail, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Alert, TextField } from "@/components/ui/form-controls";
import { errorMessage } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import { useI18n } from "@/i18n/i18n-provider";
import { AuthCard } from "./auth-card";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const { t } = useI18n();
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [emailChecked, setEmailChecked] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function checkEmail(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const result = await authApi.checkEmail(email);
      if (!result.allowed) {
        setError(t("auth.register.invalidEmail"));
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
      await register(email, displayName);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
      setSubmitting(false);
    }
  }

  const query = nextPath === "/community" ? "" : `?next=${encodeURIComponent(nextPath)}`;

  return (
    <AuthCard
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={
        <>
          {t("auth.register.hasAccount")} <Link href={`/login${query}`}>{t("auth.register.goLogin")}</Link>
        </>
      }
    >
      {sent ? (
        <div className="auth-form">
          <Alert tone="success">{t("auth.register.temporaryPasswordSent")}</Alert>
          <Link className="ui-button ui-button-primary" href={`/login${query}`}>
            {t("auth.register.goLogin")}
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={emailChecked ? handleSubmit : checkEmail}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <TextField
            label={t("auth.register.email")}
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
            }}
          />
          {emailChecked ? (
            <>
            <TextField
              label={t("auth.register.displayName")}
              name="displayName"
              icon={User}
              autoComplete="nickname"
              maxLength={40}
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <div className="auth-step-actions">
              <Button variant="ghost" icon={ArrowLeft} onClick={() => setEmailChecked(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={submitting}>
                {t("auth.register.submit")}
              </Button>
            </div>
            </>
          ) : (
            <Button type="submit" icon={ArrowRight} loading={submitting}>
              {submitting ? t("auth.register.checkingEmail") : t("auth.register.checkEmail")}
            </Button>
          )}
        </form>
      )}
    </AuthCard>
  );
}
