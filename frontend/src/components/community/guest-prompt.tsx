"use client";

import { LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/i18n/i18n-provider";

/** Shown instead of the composer to visitors who are not logged in. */
export function GuestPrompt() {
  const { t } = useI18n();
  return (
    <div className="guest-prompt card">
      <p>{t("community.guest.prompt")}</p>
      <div className="guest-prompt-actions">
        <Link className="ui-button ui-button-primary ui-button-sm" href="/login?next=/community">
          <LogIn size={16} aria-hidden /> {t("community.guest.login")}
        </Link>
        <Link className="ui-button ui-button-secondary ui-button-sm" href="/register?next=/community">
          <UserPlus size={16} aria-hidden /> {t("community.guest.register")}
        </Link>
      </div>
    </div>
  );
}
