"use client";

import { Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, TextField } from "@/components/ui/form-controls";
import { authApi } from "@/lib/api/auth";
import { errorMessage } from "@/lib/api/client";
import { useI18n } from "@/i18n/i18n-provider";
import { AuthCard } from "./auth-card";

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
      footer={<Link href="/login">{t("auth.forgot.back")}</Link>}
    >
      {sent ? (
        <Alert tone="success">{t("auth.forgot.sent")}</Alert>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <TextField
            label={t("auth.forgot.email")}
            name="email"
            type="email"
            icon={Mail}
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={submitting}>
            {t("auth.forgot.submit")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
